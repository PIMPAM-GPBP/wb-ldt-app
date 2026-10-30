"use client";

import "./prototype-map.css";

import { useEffect, useRef, useState } from "react";

import maplibregl, {
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type LngLatBounds,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";

import { useTheme } from "@/components/theme/theme-provider";
import type { AdminLabels } from "@/lib/countries";
import { defaultMapView } from "@/lib/maps/map-style";
import { loadBasemapStyle } from "@/lib/maps/openfreemap";
import { cn } from "@/lib/utils";
import type { AnalyticsFeature } from "@/types/analytics";

import { classIndexFor, splitUnit, type MapClassification, type ThemeName } from "./derive";

/**
 * Shared prototype map: MapLibre over an OpenFreeMap basemap with a classed choropleth on top.
 * Layout code depends only on these props.
 */
export type PrototypeMapProps = {
  features: AnalyticsFeature[];
  /** From classifyFeatures(features, metric.pillar, theme). Drives fill colors. */
  classification: MapClassification;
  selectedCompositeKey: string;
  /** Legend filter: when set, features outside this class are dimmed. */
  activeClassIndex: number | null;
  /** Called with the clicked feature's compositeKey. The caller decides what to do (usually update the URL). */
  onSelect: (compositeKey: string) => void;
  metricLabel: string;
  adminLabels: AdminLabels;
  /** Sizing comes from the layout: pass height and width utilities here. */
  className?: string;
  /** Extra fit padding so floating panels do not cover the country, in CSS pixels. */
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  /** Where the zoom buttons sit. Defaults to top-right. Read once when the map is created. */
  controlsPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Where the attribution sits. Defaults to bottom-right; move it when a panel covers that corner. Read once. */
  attributionPosition?: "bottom-left" | "bottom-right";
};

type Padding = NonNullable<PrototypeMapProps["fitPadding"]>;

type UnitProperties = AnalyticsFeature["properties"] & {
  metricValue: number | null;
  /** Index into classification.classes, or -1 when the unit has no value. */
  classIndex: number;
};
type UnitCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, UnitProperties>;

/** Everything the imperative map code reads. Refreshed after every render. */
type Latest = Pick<
  PrototypeMapProps,
  | "features"
  | "classification"
  | "selectedCompositeKey"
  | "activeClassIndex"
  | "onSelect"
  | "metricLabel"
  | "adminLabels"
  | "fitPadding"
  | "controlsPosition"
  | "attributionPosition"
> & { theme: ThemeName };

/** State that belongs to the current map instance. Per-style fields reset on every style.load. */
type Session = {
  basemapTheme: ThemeName;
  beforeLayerId: string | undefined;
  dataSignature: string;
  fittedKey: string;
  paddingKey: string;
  hoveredKey: string;
  countryLabelFilters: Map<string, FilterSpecification | undefined>;
  countryLabelZone: GeoJSON.Polygon | null;
  hideHover: () => void;
};

const SOURCE_ID = "proto-units";
const FILL_ID = "proto-units-fill";
const BORDER_ID = "proto-units-border";
const HALO_ID = "proto-units-select-halo";
const SELECT_ID = "proto-units-select";
const HOVER_ID = "proto-units-hover";

const FILL_OPACITY = 0.85;
const DIMMED_OPACITY = 0.12;
const BASE_PADDING = 24;
const BOUNDS_MARGIN = 0.6;

const CHROME: Record<ThemeName, { border: string; halo: string; selected: string; hover: string }> = {
  light: { border: "rgba(27,35,64,0.22)", halo: "#ffffff", selected: "#1b2340", hover: "#1b2340" },
  dark: { border: "rgba(245,247,255,0.16)", halo: "#021420", selected: "#ffffff", hover: "#ffffff" },
};

const NO_FEATURE: FilterSpecification = ["==", ["get", "compositeKey"], ""];

function keyFilter(compositeKey: string): FilterSpecification {
  return ["==", ["get", "compositeKey"], compositeKey];
}

function fillColor(classification: MapClassification) {
  if (classification.classes.length === 0) return classification.noDataColor;
  return [
    "match",
    ["get", "classIndex"],
    ...classification.classes.flatMap((entry) => [entry.index, entry.color]),
    classification.noDataColor,
  ] as unknown as ExpressionSpecification;
}

function fillOpacity(activeClassIndex: number | null) {
  if (activeClassIndex === null) return FILL_OPACITY;
  return ["case", ["==", ["get", "classIndex"], activeClassIndex], FILL_OPACITY, DIMMED_OPACITY] as ExpressionSpecification;
}

function buildData(features: AnalyticsFeature[], classification: MapClassification): UnitCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        metricValue: feature.metricValue,
        classIndex: feature.metricValue === null ? -1 : (classIndexFor(feature.metricValue, classification.classes) ?? -1),
      },
    })),
  };
}

/** Cheap content fingerprint so selection and legend changes never re-tile the geometry. */
function signatureOf(data: UnitCollection) {
  return data.features
    .map(({ properties }) => `${properties.compositeKey}:${properties.metricValue}:${properties.classIndex}`)
    .join("|");
}

/** Identity of the feature set: a different country or filter changes it, a different metric does not. */
function fitKeyOf(features: AnalyticsFeature[]) {
  if (features.length === 0) return "";
  return `${features.length}:${features[0].properties.compositeKey}:${features[features.length - 1].properties.compositeKey}`;
}

function getBounds(features: AnalyticsFeature[]) {
  const bounds = new maplibregl.LngLatBounds();

  function extend(coordinates: unknown) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
      bounds.extend([coordinates[0], coordinates[1]]);
      return;
    }
    for (const part of coordinates as unknown[]) extend(part);
  }

  for (const feature of features) {
    const { geometry } = feature;
    if (geometry.type === "GeometryCollection") {
      for (const part of geometry.geometries) {
        if ("coordinates" in part) extend(part.coordinates);
      }
    } else {
      extend(geometry.coordinates);
    }
  }

  return bounds;
}

function expandBounds(bounds: LngLatBounds): [number, number, number, number] {
  const dx = (bounds.getEast() - bounds.getWest()) * BOUNDS_MARGIN;
  const dy = (bounds.getNorth() - bounds.getSouth()) * BOUNDS_MARGIN;
  return [
    Math.max(-180, bounds.getWest() - dx),
    Math.max(-85, bounds.getSouth() - dy),
    Math.min(180, bounds.getEast() + dx),
    Math.min(85, bounds.getNorth() + dy),
  ];
}

function boundsPolygon(bounds: LngLatBounds): GeoJSON.Polygon {
  const [west, south, east, north] = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function paddingKeyOf(padding: Padding | undefined) {
  return padding ? `${padding.top},${padding.right},${padding.bottom},${padding.left}` : "0,0,0,0";
}

/**
 * The layout's extra padding, shrunk when the panels would leave under a quarter of the map open.
 * It is applied as map padding, so the camera centre sits in the middle of the open area.
 */
function openAreaPadding(extra: Padding | undefined, width: number, height: number): Padding {
  const squeeze = (start: number, end: number, size: number) => {
    const room = Math.max(0, size * 0.75 - 2 * BASE_PADDING);
    return start + end > room ? room / (start + end) : 1;
  };
  const horizontal = squeeze(extra?.left ?? 0, extra?.right ?? 0, width);
  const vertical = squeeze(extra?.top ?? 0, extra?.bottom ?? 0, height);
  return {
    top: (extra?.top ?? 0) * vertical,
    bottom: (extra?.bottom ?? 0) * vertical,
    left: (extra?.left ?? 0) * horizontal,
    right: (extra?.right ?? 0) * horizontal,
  };
}

/**
 * Hides the basemap's country-name labels whose anchor sits inside the data bounds, so the map does not
 * print the country's own name across its choropleth. Neighbouring countries keep their labels.
 */
function applyCountryLabelZone(map: MapLibreMap, session: Session) {
  for (const [id, base] of session.countryLabelFilters) {
    if (!map.getLayer(id)) continue;
    const zone = session.countryLabelZone;
    if (!zone) {
      map.setFilter(id, base ?? null);
      continue;
    }
    const outside = ["!", ["within", zone]] as unknown as FilterSpecification;
    map.setFilter(id, base ? (["all", base, outside] as FilterSpecification) : outside);
  }
}

function fitIfNeeded(map: MapLibreMap, session: Session, latest: Latest, container: HTMLElement) {
  const key = fitKeyOf(latest.features);
  if (key === "" || key === session.fittedKey) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  const bounds = getBounds(latest.features);
  if (bounds.isEmpty()) return;

  map.resize();
  map.setMaxBounds(null);
  // Panel padding goes on the map itself so later changes can ease it; the fit adds the 24px base around the open area.
  map.setPadding(openAreaPadding(latest.fitPadding, width, height));
  map.fitBounds(bounds, { padding: BASE_PADDING, duration: 0 });
  map.setMaxBounds(expandBounds(bounds));

  session.fittedKey = key;
  session.paddingKey = paddingKeyOf(latest.fitPadding);
  session.countryLabelZone = boundsPolygon(bounds);
  applyCountryLabelZone(map, session);
}

/** After the first fit, a changed fitPadding eases the country into the new open area. Zoom and centre stay put. */
function easePaddingIfChanged(map: MapLibreMap, session: Session, latest: Latest, container: HTMLElement) {
  const key = paddingKeyOf(latest.fitPadding);
  if (session.fittedKey === "" || key === session.paddingKey) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  session.paddingKey = key;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.easeTo({
    padding: openAreaPadding(latest.fitPadding, width, height),
    duration: reduceMotion ? 0 : 200,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

function addDataLayers(map: MapLibreMap, session: Session, latest: Latest) {
  const chrome = CHROME[session.basemapTheme];
  const before = session.beforeLayerId && map.getLayer(session.beforeLayerId) ? session.beforeLayerId : undefined;
  const selected = keyFilter(latest.selectedCompositeKey);
  const data = buildData(latest.features, latest.classification);

  map.addSource(SOURCE_ID, { type: "geojson", data, maxzoom: 12 });
  session.dataSignature = signatureOf(data);

  map.addLayer(
    {
      id: FILL_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": fillColor(latest.classification),
        "fill-opacity": fillOpacity(latest.activeClassIndex),
      },
    },
    before,
  );
  map.addLayer(
    {
      id: BORDER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-join": "round" },
      paint: {
        "line-color": chrome.border,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 7, 0.5, 10, 0.9, 12, 1.3],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: HALO_ID,
      type: "line",
      source: SOURCE_ID,
      filter: selected,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": chrome.halo, "line-width": 5 },
    },
    before,
  );
  map.addLayer(
    {
      id: SELECT_ID,
      type: "line",
      source: SOURCE_ID,
      filter: selected,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": chrome.selected, "line-width": 2.5 },
    },
    before,
  );
  map.addLayer(
    {
      id: HOVER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: NO_FEATURE,
      layout: { "line-join": "round" },
      paint: { "line-color": chrome.hover, "line-width": 1.5 },
    },
    before,
  );
}

/** Pushes the latest props into the map in place. Cheap calls are repeated; the geometry is only re-set on change. */
function syncMap(map: MapLibreMap, session: Session, latest: Latest) {
  if (!map.getLayer(FILL_ID)) return;

  const data = buildData(latest.features, latest.classification);
  const signature = signatureOf(data);
  if (signature !== session.dataSignature) {
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
    session.dataSignature = signature;
    session.hideHover();
  }

  map.setPaintProperty(FILL_ID, "fill-color", fillColor(latest.classification));
  map.setPaintProperty(FILL_ID, "fill-opacity", fillOpacity(latest.activeClassIndex));

  const selected = keyFilter(latest.selectedCompositeKey);
  map.setFilter(HALO_ID, selected);
  map.setFilter(SELECT_ID, selected);
}

function createTip() {
  const element = document.createElement("div");
  element.className = "proto-tip";

  const name = document.createElement("div");
  name.className = "proto-tip-name";
  const where = document.createElement("div");
  where.className = "proto-tip-where";
  const row = document.createElement("div");
  row.className = "proto-tip-row";
  const label = document.createElement("span");
  label.className = "proto-tip-label";
  const value = document.createElement("span");
  value.className = "proto-tip-value";
  const swatch = document.createElement("span");
  swatch.className = "proto-tip-swatch";
  const number = document.createElement("span");
  value.append(swatch, number);
  row.append(label, value);
  element.append(name, where, row);

  return {
    element,
    update(properties: Record<string, unknown>, latest: Latest) {
      const { adminLabels, classification } = latest;
      const metricValue = typeof properties.metricValue === "number" ? properties.metricValue : null;
      const classIndex = typeof properties.classIndex === "number" ? properties.classIndex : -1;
      const higher = `${String(properties.Province)} ${adminLabels.higher.singular.toLowerCase()}`;

      name.textContent = String(properties.Municipality);
      where.textContent = adminLabels.middle
        ? `${String(properties.District)} ${adminLabels.middle.singular.toLowerCase()}, ${higher}`
        : higher;
      label.textContent = splitUnit(latest.metricLabel).name;
      number.textContent = metricValue === null ? "No data" : metricValue.toFixed(1);
      swatch.style.background =
        classification.classes.find((entry) => entry.index === classIndex)?.color ?? classification.noDataColor;
    },
  };
}

function mountMap(
  container: HTMLElement,
  basemap: { style: StyleSpecification; beforeLayerId: string | undefined },
  theme: ThemeName,
  latestRef: { current: Latest | null },
  onReady: (map: MapLibreMap, session: Session) => void,
) {
  const latest = latestRef.current as Latest;
  const map = new maplibregl.Map({
    container,
    style: basemap.style,
    center: [defaultMapView.longitude, defaultMapView.latitude],
    zoom: defaultMapView.zoom,
    maxZoom: 13,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    renderWorldCopies: false,
    cooperativeGestures: true,
    attributionControl: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __protoMap?: MapLibreMap }).__protoMap = map;
  }
  // Attribution first: bottom controls stack upward, so it stays at the very bottom.
  map.addControl(new maplibregl.AttributionControl({ compact: true }), latest.attributionPosition ?? "bottom-right");
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
    latest.controlsPosition ?? "top-right",
  );

  const tip = createTip();
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    closeOnMove: false,
    focusAfterOpen: false,
    className: "proto-map-popup",
    maxWidth: "260px",
    offset: 14,
  }).setDOMContent(tip.element);

  const session: Session = {
    basemapTheme: theme,
    beforeLayerId: basemap.beforeLayerId,
    dataSignature: "",
    fittedKey: "",
    paddingKey: "",
    hoveredKey: "",
    countryLabelFilters: new Map(),
    countryLabelZone: null,
    hideHover: () => {
      session.hoveredKey = "";
      if (map.getLayer(HOVER_ID)) map.setFilter(HOVER_ID, NO_FEATURE);
      popup.remove();
      map.getCanvas().style.cursor = "";
    },
  };

  const hoverQuery = window.matchMedia("(hover: hover)");

  function queryUnit(event: MapMouseEvent) {
    if (!map.getLayer(FILL_ID)) return undefined;
    return map.queryRenderedFeatures(event.point, { layers: [FILL_ID] })[0];
  }

  // OpenFreeMap's Dark sprite has no "circle-11" for city dots; draw one in the label color.
  map.on("styleimagemissing", ({ id }) => {
    if (id !== "circle-11" || map.hasImage(id)) return;
    const size = 11;
    const pixels = new Uint8Array(size * size * 4);
    const fill = session.basemapTheme === "dark" ? [201, 211, 234] : [27, 35, 64];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distance = Math.hypot(x - 5, y - 5);
        const offset = (y * size + x) * 4;
        // A filled dot with a one-pixel white ring, transparent outside.
        const color = distance <= 2.6 ? fill : [255, 255, 255];
        pixels.set([...color, distance <= 3.6 ? 255 : 0], offset);
      }
    }
    map.addImage(id, { width: size, height: size, data: pixels });
  });

  map.on("style.load", () => {
    session.hoveredKey = "";
    session.countryLabelFilters.clear();
    for (const layer of map.getStyle().layers) {
      if (layer.type === "symbol" && layer.id.includes("country")) {
        session.countryLabelFilters.set(layer.id, layer.filter);
      }
    }
    applyCountryLabelZone(map, session);
    addDataLayers(map, session, latestRef.current as Latest);
  });

  map.on("mousemove", (event) => {
    if (!hoverQuery.matches || map.isMoving()) return;
    const feature = queryUnit(event);
    if (!feature?.properties) {
      session.hideHover();
      return;
    }
    const key = String(feature.properties.compositeKey);
    if (key !== session.hoveredKey) {
      session.hoveredKey = key;
      map.setFilter(HOVER_ID, keyFilter(key));
      tip.update(feature.properties, latestRef.current as Latest);
    }
    popup.setLngLat(event.lngLat);
    if (!popup.isOpen()) popup.addTo(map);
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseout", session.hideHover);
  map.on("movestart", session.hideHover);

  map.on("click", (event) => {
    const key = queryUnit(event)?.properties?.compositeKey;
    if (typeof key === "string") (latestRef.current as Latest).onSelect(key);
  });

  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      map.resize();
      fitIfNeeded(map, session, latestRef.current as Latest, container);
    });
  });
  observer.observe(container);

  fitIfNeeded(map, session, latest, container);
  onReady(map, session);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    popup.remove();
    map.remove();
  };
}

export function PrototypeMap({
  features,
  classification,
  selectedCompositeKey,
  activeClassIndex,
  onSelect,
  metricLabel,
  adminLabels,
  className,
  fitPadding,
  controlsPosition,
  attributionPosition,
}: PrototypeMapProps) {
  const { theme } = useTheme();
  const paddingKey = paddingKeyOf(fitPadding);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRef = useRef<Latest | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Declared first so every effect below sees this render's props.
  useEffect(() => {
    latestRef.current = {
      features,
      classification,
      selectedCompositeKey,
      activeClassIndex,
      onSelect,
      metricLabel,
      adminLabels,
      fitPadding,
      controlsPosition,
      attributionPosition,
      theme,
    };
  });

  // Create the map once the basemap style has loaded. Until then the container shows the sunken surface.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let dispose: (() => void) | undefined;
    const initialTheme = (latestRef.current as Latest).theme;

    void loadBasemapStyle(initialTheme).then((basemap) => {
      if (disposed) return;
      dispose = mountMap(container, basemap, initialTheme, latestRef, (map, session) => {
        mapRef.current = map;
        sessionRef.current = session;
        setReady(true);
      });
    });

    return () => {
      disposed = true;
      dispose?.();
      mapRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  // Swap the basemap on a theme change. style.load re-adds the data layers on the new style.
  useEffect(() => {
    const map = mapRef.current;
    const session = sessionRef.current;
    if (!ready || !map || !session || session.basemapTheme === theme) return;

    let stale = false;
    void loadBasemapStyle(theme).then(({ style, beforeLayerId }) => {
      if (stale || mapRef.current !== map) return;
      session.basemapTheme = theme;
      session.beforeLayerId = beforeLayerId;
      map.setStyle(style, { diff: false });
    });
    return () => {
      stale = true;
    };
  }, [ready, theme]);

  // Push props into the existing map. Never re-creates it.
  useEffect(() => {
    const map = mapRef.current;
    const session = sessionRef.current;
    const container = containerRef.current;
    if (!ready || !map || !session || !container) return;

    const latest = latestRef.current as Latest;
    syncMap(map, session, latest);
    fitIfNeeded(map, session, latest, container);
    easePaddingIfChanged(map, session, latest, container);
  }, [ready, features, classification, selectedCompositeKey, activeClassIndex, paddingKey]);

  return (
    <div
      className={cn("proto-map relative overflow-hidden bg-[var(--proto-surface-sunken)]", className)}
      role="group"
      aria-label={`Map of ${metricLabel} by ${adminLabels.lower.singular.toLowerCase()}`}
    >
      <div ref={containerRef} className="proto-map-canvas" />
    </div>
  );
}
