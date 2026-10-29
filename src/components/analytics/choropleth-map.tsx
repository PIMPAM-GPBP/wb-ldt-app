"use client";

import { useEffect, useMemo, useRef } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map } from "maplibre-gl";

import { defaultMapView, mapStyle } from "@/lib/maps/map-style";
import type { AdminLabels } from "@/lib/countries";
import type { AnalyticsFeature, MetricDefinition } from "@/types/analytics";

type ChoroplethMapCardProps = {
  features: AnalyticsFeature[];
  metric: MetricDefinition;
  selectedCompositeKey: string;
  coverageLabel: string;
  minimum: number | null;
  maximum: number | null;
  adminLabels: AdminLabels;
};

type SourceProperties = AnalyticsFeature["properties"] & {
  metricValue: number | null;
};

function formatMetricValue(value: number | null) {
  return value === null ? "No data" : value.toFixed(2);
}

function buildPopupContent(
  properties: SourceProperties,
  metricLabel: string,
  adminLabels: AdminLabels,
) {
  const container = document.createElement("div");
  container.className = "space-y-1";

  const title = document.createElement("div");
  title.className = "font-semibold";
  title.textContent = properties.Municipality;
  container.appendChild(title);

  const location = document.createElement("div");
  location.className = "text-xs text-slate-500";
  location.textContent = adminLabels.middle
    ? `${adminLabels.middle.singular}: ${properties.District} | ${adminLabels.higher.singular}: ${properties.Province}`
    : `${adminLabels.higher.singular}: ${properties.Province}`;
  container.appendChild(location);

  const value = document.createElement("div");
  value.className = "mt-2 text-sm";
  value.textContent = `${metricLabel}: `;

  const numericValue = document.createElement("span");
  numericValue.className = "font-mono";
  numericValue.textContent = formatMetricValue(properties.metricValue);
  value.appendChild(numericValue);
  container.appendChild(value);

  return container;
}

function buildFillExpression(minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null) {
    return ["literal", "#e7e7e7"] as unknown as ExpressionSpecification;
  }

  if (maximum <= minimum) {
    return [
      "case",
      ["==", ["get", "metricValue"], null],
      "#e7e7e7",
      "#3675b7",
    ] as ExpressionSpecification;
  }

  return [
    "case",
    ["==", ["get", "metricValue"], null],
    "#e7e7e7",
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "metricValue"]],
      minimum,
      "#e5ebf8",
      maximum,
      "#3675b7",
    ],
  ] as ExpressionSpecification;
}

function getBounds(features: AnalyticsFeature[]) {
  const bounds = new maplibregl.LngLatBounds();

  function extendCoordinates(coordinates: unknown) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return;
    }

    if (
      Array.isArray(coordinates[0]) &&
      typeof coordinates[0][0] === "number" &&
      typeof coordinates[0][1] === "number"
    ) {
      for (const [longitude, latitude] of coordinates as GeoJSON.Position[]) {
        bounds.extend([longitude, latitude]);
      }
      return;
    }

    for (const part of coordinates as unknown[]) {
      extendCoordinates(part);
    }
  }

  for (const feature of features) {
    if (feature.geometry.type === "GeometryCollection") {
      for (const geometry of feature.geometry.geometries) {
        if ("coordinates" in geometry) {
          extendCoordinates(geometry.coordinates);
        }
      }
      continue;
    }

    extendCoordinates(feature.geometry.coordinates);
  }

  return bounds;
}

function buildSourceData(features: AnalyticsFeature[]): GeoJSON.FeatureCollection<GeoJSON.Geometry, SourceProperties> {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        metricValue: feature.metricValue,
      },
    })),
  };
}

export function ChoroplethMapCard({
  features,
  metric,
  selectedCompositeKey,
  coverageLabel,
  minimum,
  maximum,
  adminLabels,
}: ChoroplethMapCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sourceData = useMemo(() => buildSourceData(features), [features]);
  const metricLabelRef = useRef(metric.label);
  const searchParamsRef = useRef(searchParams.toString());
  const featuresRef = useRef(features);
  const sourceDataRef = useRef(sourceData);
  const minimumRef = useRef(minimum);
  const maximumRef = useRef(maximum);
  const selectedCompositeKeyRef = useRef(selectedCompositeKey);
  const adminLabelsRef = useRef(adminLabels);

  useEffect(() => {
    metricLabelRef.current = metric.label;
    searchParamsRef.current = searchParams.toString();
    featuresRef.current = features;
    sourceDataRef.current = sourceData;
    minimumRef.current = minimum;
    maximumRef.current = maximum;
    selectedCompositeKeyRef.current = selectedCompositeKey;
    adminLabelsRef.current = adminLabels;
  }, [adminLabels, features, maximum, metric.label, minimum, searchParams, selectedCompositeKey, sourceData]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [defaultMapView.longitude, defaultMapView.latitude],
      zoom: defaultMapView.zoom,
      attributionControl: false,
      cooperativeGestures: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "nepal-map-popup",
    });

    map.on("load", () => {
      map.addSource("municipalities", {
        type: "geojson",
        data: sourceDataRef.current,
      });

      map.addLayer({
        id: "municipality-fills",
        type: "fill",
        source: "municipalities",
        paint: {
          "fill-color": buildFillExpression(minimumRef.current, maximumRef.current),
          "fill-opacity": 0.72,
        },
      });

      map.addLayer({
        id: "municipality-borders",
        type: "line",
        source: "municipalities",
        paint: {
          "line-color": "rgba(55,66,145,0.24)",
          "line-width": 0.8,
        },
      });

      map.addLayer({
        id: "municipality-highlight",
        type: "line",
        source: "municipalities",
        filter: ["==", ["get", "compositeKey"], selectedCompositeKeyRef.current],
        paint: {
          "line-color": "#e07a5f",
          "line-width": 2.4,
        },
      });

      map.on("mouseenter", "municipality-fills", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "municipality-fills", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });

      map.on("mousemove", "municipality-fills", (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as SourceProperties | undefined;

        if (!properties) {
          return;
        }

        popupRef.current
          ?.setLngLat(event.lngLat)
          .setDOMContent(
            buildPopupContent(
              properties,
              metricLabelRef.current,
              adminLabelsRef.current,
            ),
          )
          .addTo(map);
      });

      map.on("click", "municipality-fills", (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as SourceProperties | undefined;

        if (!properties?.compositeKey) {
          return;
        }

        const nextParams = new URLSearchParams(searchParamsRef.current);
        nextParams.set("municipality", properties.compositeKey);
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
      });

      if (featuresRef.current.length > 0) {
        const bounds = getBounds(featuresRef.current);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 32,
            duration: 0,
            maxZoom: 9,
          });
        }
      }

      mapRef.current = map;
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [pathname, router]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource("municipalities") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData(sourceData);

    if (map.getLayer("municipality-fills")) {
      map.setPaintProperty(
        "municipality-fills",
        "fill-color",
        buildFillExpression(minimum, maximum),
      );
    }

    if (map.getLayer("municipality-highlight")) {
      map.setFilter("municipality-highlight", [
        "==",
        ["get", "compositeKey"],
        selectedCompositeKey,
      ]);
    }

    if (features.length > 0) {
      const bounds = getBounds(features);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 32,
          duration: 600,
          maxZoom: 9,
        });
      }
    }
  }, [features, maximum, minimum, selectedCompositeKey, sourceData]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Choropleth
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {metric.label}
          </h2>
        </div>
        <span className="rounded-full bg-[rgba(54,117,183,0.12)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
          {coverageLabel}
        </span>
      </div>
      <div className="relative border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(238,242,251,0.9))] px-4 py-4">
        <div ref={containerRef} className="h-[460px] w-full overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)]" />
        <div className="pointer-events-none absolute bottom-8 left-8 rounded-2xl border border-[var(--border-soft)] bg-white/88 px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Legend
          </p>
          <div className="mt-3 h-3 w-44 rounded-full bg-[linear-gradient(90deg,#e5ebf8_0%,#3675b7_100%)]" />
          <div className="mt-2 flex justify-between font-mono text-xs text-[var(--muted-foreground)]">
            <span>{minimum === null ? "n/a" : minimum.toFixed(2)}</span>
            <span>{maximum === null ? "n/a" : maximum.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 px-6 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Minimum
          </p>
          <p className="mt-2 font-mono text-base text-[var(--foreground)]">
            {minimum === null ? "n/a" : minimum.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Maximum
          </p>
          <p className="mt-2 font-mono text-base text-[var(--foreground)]">
            {maximum === null ? "n/a" : maximum.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Rendered features
          </p>
          <p className="mt-2 font-mono text-base text-[var(--foreground)]">
            {features.length}
          </p>
        </div>
      </div>
    </section>
  );
}
