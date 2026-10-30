import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

export type BasemapTheme = "light" | "dark";

export type Basemap = {
  style: StyleSpecification;
  /** First symbol layer left after the transform. Add data layers before it so every label sits above them. */
  beforeLayerId: string | undefined;
};

const STYLE_URL: Record<BasemapTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// Land matches the page background (--background) so the map container and the basemap agree while a
// style loads or swaps; water sits a step off it. Label colors keep text legible on top of the choropleth fills.
const PALETTE = {
  light: {
    land: "#f7f9fd",
    water: "#dbe3ef",
    placeText: "#1b2340",
    placeHalo: "#ffffff",
    waterText: "#4d6190",
    waterHalo: "rgba(255,255,255,0.7)",
  },
  dark: {
    land: "#021420",
    water: "#082033",
    placeText: "#d9dff0",
    placeHalo: "rgba(2,20,32,0.9)",
    waterText: "#7f93b8",
    waterHalo: "rgba(2,20,32,0.7)",
  },
} as const;

const ENGLISH_FIRST = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];

// Hamlets, neighbourhoods and suburbs add noise at country scale. City, town, village, state and country stay.
const DROPPED_PLACE_LAYERS = new Set(["label_other", "place_other", "place_suburb"]);

const ROAD_OPACITY_FACTOR = 0.5;

function keepLabel(layer: LayerSpecification) {
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  if (sourceLayer === "water_name") return true;
  if (sourceLayer === "place") return !DROPPED_PLACE_LAYERS.has(layer.id);
  // POI, aerodrome, housenumber, transportation (oneway arrows), transportation_name (road names and
  // shields) and waterway line labels all fall through to here.
  return false;
}

function restyleLabel(layer: LayerSpecification, theme: BasemapTheme) {
  const palette = PALETTE[theme];
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  const layout = (layer.layout ??= {}) as Record<string, unknown>;
  const paint = (layer.paint ??= {}) as Record<string, unknown>;

  layout["text-field"] = ENGLISH_FIRST;

  if (sourceLayer === "place") {
    paint["text-color"] = palette.placeText;
    paint["text-halo-color"] = palette.placeHalo;
    paint["text-halo-width"] = 1.5;
  } else if (sourceLayer === "water_name") {
    paint["text-color"] = palette.waterText;
    paint["text-halo-color"] = palette.waterHalo;
  }
}

function restyleShape(layer: LayerSpecification, theme: BasemapTheme) {
  const palette = PALETTE[theme];
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;

  if (layer.type === "background") {
    (layer.paint ??= {})["background-color"] = palette.land;
  } else if (layer.type === "fill" && sourceLayer === "water") {
    (layer.paint ??= {})["fill-color"] = palette.water;
  } else if (layer.type === "line" && sourceLayer === "transportation") {
    // Every road and railway layer in both styles uses a constant or missing line-opacity.
    const paint = (layer.paint ??= {});
    const current = paint["line-opacity"];
    if (current === undefined) paint["line-opacity"] = ROAD_OPACITY_FACTOR;
    else if (typeof current === "number") paint["line-opacity"] = current * ROAD_OPACITY_FACTOR;
  }
}

/** Pure transform of an OpenFreeMap style: English labels, a quiet label set, receding roads, labels last. */
export function transformBasemapStyle(source: StyleSpecification, theme: BasemapTheme): Basemap {
  const style = structuredClone(source);
  const shapes: LayerSpecification[] = [];
  const labels: LayerSpecification[] = [];

  for (const layer of style.layers) {
    if (layer.type === "symbol") {
      if (!keepLabel(layer)) continue;
      restyleLabel(layer, theme);
      labels.push(layer);
    } else {
      // The Dark style's wood layer fills with "wood-pattern", which neither sprite contains. MapLibre
      // draws nothing for it and warns on every load, so it is dropped here.
      if ("paint" in layer && layer.paint && "fill-pattern" in layer.paint) continue;
      restyleShape(layer, theme);
      shapes.push(layer);
    }
  }

  // The dark style puts water_name before buildings and roads. Moving every label to the end makes
  // "before the first symbol layer" mean "under all labels and above all shapes" in both styles.
  style.layers = [...shapes, ...labels];
  return { style, beforeLayerId: labels[0]?.id };
}

function blankBasemap(theme: BasemapTheme): Basemap {
  return {
    style: {
      version: 8,
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": PALETTE[theme].land } }],
    },
    beforeLayerId: undefined,
  };
}

const cache = new Map<BasemapTheme, Promise<Basemap>>();

async function fetchBasemap(theme: BasemapTheme): Promise<Basemap> {
  const response = await fetch(STYLE_URL[theme]);
  if (!response.ok) throw new Error(`OpenFreeMap ${theme} style responded ${response.status}`);
  return transformBasemapStyle((await response.json()) as StyleSpecification, theme);
}

/**
 * Loads and transforms the OpenFreeMap style for a theme. The fetch is cached per theme; every call
 * returns its own copy because MapLibre may keep references into the object it is given.
 * If the fetch fails, the map still renders data on a blank background and the next call retries.
 */
export async function loadBasemapStyle(theme: BasemapTheme): Promise<Basemap> {
  let pending = cache.get(theme);
  if (!pending) {
    pending = fetchBasemap(theme);
    cache.set(theme, pending);
  }

  try {
    const basemap = await pending;
    return { style: structuredClone(basemap.style), beforeLayerId: basemap.beforeLayerId };
  } catch (error) {
    cache.delete(theme);
    console.warn("Basemap unavailable, drawing data on a blank background.", error);
    return blankBasemap(theme);
  }
}
