import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PILLARS, pillarRamp } from "@/lib/analytics/derive";
import { bandScale, classIndexFor } from "@/lib/analytics/ranking";
import type { Country } from "@/lib/countries";
import { buildOutlineMap, type BoundaryCollection } from "@/lib/maps/outline";
import type { AnalyticsDataset, Pillar } from "@/types/analytics";

/** One country as a static SVG map: every unit's outline, name, and fifth on each pillar. */
export type PillarMap = {
  slug: string;
  width: number;
  height: number;
  units: Array<{ key: string; name: string; d: string; classes: Partial<Record<Pillar, number>> }>;
};

export const PILLAR_MAP_CLASSES = 5;

const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as T;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// The boundaries and scores change only with a deploy, so each map is built once per server.
const cache = new Map<string, Promise<PillarMap>>();

/**
 * Classes are fifths within the country, as on the map legend, so maps of different countries
 * share a color scale without comparing scores across countries.
 */
export function getPillarMap(country: Country, width: number, height: number, epsilon = 1): Promise<PillarMap> {
  const key = `${country.slug}:${width}x${height}:${epsilon}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const built = buildPillarMap(country, width, height, epsilon);
  cache.set(key, built);
  built.catch(() => cache.delete(key));
  return built;
}

async function buildPillarMap(country: Country, width: number, height: number, epsilon: number): Promise<PillarMap> {
  const [boundaries, dataset] = await Promise.all([readJson<BoundaryCollection>(country.mapDataPath), readJson<AnalyticsDataset>(country.fallbackDataPath)]);
  const latest = new Map(dataset.municipalities.filter((unit) => unit.year === dataset.release.year).map((unit) => [unit.compositeKey, unit]));
  const outline = buildOutlineMap(boundaries, width, height, epsilon);
  const scored = outline.units.filter((unit) => latest.has(unit.compositeKey));
  const scales = new Map(
    PILLARS.map((pillar) => [pillar.id, bandScale(scored.map((unit) => latest.get(unit.compositeKey)!.scores[pillar.scoreId]).filter(isNumber), PILLAR_MAP_CLASSES)]),
  );
  return {
    slug: country.slug,
    width: outline.width,
    height: outline.height,
    units: outline.units.map((unit) => {
      const record = latest.get(unit.compositeKey);
      const classes: Partial<Record<Pillar, number>> = {};
      for (const pillar of PILLARS) {
        const value = record?.scores[pillar.scoreId];
        const index = isNumber(value) ? classIndexFor(value, scales.get(pillar.id) ?? []) : null;
        if (index !== null) classes[pillar.id] = index;
      }
      return { key: unit.compositeKey, name: record?.municipality ?? unit.compositeKey.split("::").at(-1) ?? unit.compositeKey, d: unit.d, classes };
    }),
  };
}

/** Fills for every pillar and class in both themes, keyed on the data attributes the maps and legend carry. */
export function pillarMapStyles() {
  const base = "[data-map-pillar] svg path{fill:var(--surface-muted);stroke:var(--background);stroke-width:0.6;vector-effect:non-scaling-stroke}";
  const fills = PILLARS.flatMap((pillar) => {
    const attribute = `data-${pillar.id[0]}`;
    return (["light", "dark"] as const).flatMap((theme) =>
      pillarRamp(pillar.id, theme, PILLAR_MAP_CLASSES).map((color, index) => {
        const scope = `${theme === "dark" ? ".dark " : ""}[data-map-pillar="${pillar.id}"]`;
        return `${scope} path[${attribute}="${index}"],${scope} [data-swatch="${index}"]{fill:${color};background-color:${color}}`;
      }),
    );
  });
  return base + fills.join("");
}
