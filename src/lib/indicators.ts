import "server-only";

import { splitUnit } from "@/lib/analytics/ranking";
import { countries } from "@/lib/countries";
import { loadCountryDataset } from "@/lib/country-landing-data";
import { scoreComponentIndicatorMappings } from "@/lib/data/labels";
import type { Pillar } from "@/types/analytics";

export type IndicatorRow = {
  id: string;
  name: string;
  unit: string | null;
  pillar: Pillar | null;
  /** The score component the indicator feeds; null for context indicators. */
  component: string | null;
  description: string;
  /** True where the source metadata's description is wrong and this one replaces it. */
  descriptionCorrected: boolean;
  /** Null where the source does not say. */
  higherIsBetter: boolean | null;
  /** Years in which any unit in any country has a recorded value. */
  years: number[];
  sources: Array<{ label: string; url?: string | null }>;
};

/**
 * The source metadata swaps the descriptions of three hazard indicators (road flood carries the
 * railway flood text, road heatwave the road flood text, railway heatwave the road heatwave
 * text). The first two corrections reuse the source's own wording; the railway heatwave one
 * follows the same pattern.
 */
const CORRECTED_DESCRIPTIONS: Record<string, string> = {
  "road-flood-risk": "Assesses the share of the region's total length of road exposure to 1-in-100-year flood risks for climate adaptation planning.",
  "road-heatwave-risk": "Measures road length at risk from heatwaves in high-emission climate scenarios.",
  "railway-heatwave-risk": "Measures railway length at risk from heatwaves in high-emission climate scenarios.",
};

let cached: Promise<IndicatorRow[]> | null = null;

/** Every indicator with what it measures, its direction, the years it is recorded, and its sources. */
export function getIndicatorTable(): Promise<IndicatorRow[]> {
  cached ??= buildIndicatorTable();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

async function buildIndicatorTable(): Promise<IndicatorRow[]> {
  const datasets = await Promise.all(countries.filter((country) => country.analyticsStatus === "live").map(loadCountryDataset));
  const [first] = datasets;
  const componentLabels = new Map(
    first.scoreDefinitions.flatMap((definition) => definition.componentIds.map((id, index) => [id, (definition.componentLabels[index] ?? id).replace(/ Score$/, "")] as const)),
  );
  const componentFor = new Map(Object.entries(scoreComponentIndicatorMappings).map(([componentId, indicatorId]) => [indicatorId as string, componentLabels.get(componentId) ?? null]));

  return [...first.indicatorDefinitions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition) => {
      const years = new Set<number>();
      for (const dataset of datasets) {
        for (const unit of dataset.municipalities) {
          const value = unit.indicators[definition.id];
          if (typeof value === "number" && value !== 0) years.add(unit.year);
        }
      }
      const { name, unit } = splitUnit(definition.label);
      const corrected = CORRECTED_DESCRIPTIONS[definition.id];
      return {
        id: definition.id,
        name,
        unit,
        pillar: definition.pillar,
        component: componentFor.get(definition.id) ?? null,
        description: corrected ?? definition.description ?? "",
        descriptionCorrected: Boolean(corrected),
        higherIsBetter: definition.higherIsBetter,
        years: [...years].sort((a, b) => a - b),
        sources: definition.sources,
      };
    });
}

/** "2021 to 2025", "2025 only", or a list where the years are not consecutive. */
export function formatYears(years: readonly number[]) {
  if (years.length === 0) return "Not recorded";
  if (years.length === 1) return `${years[0]} only`;
  const consecutive = years.every((year, index) => index === 0 || year === years[index - 1] + 1);
  return consecutive ? `${years[0]} to ${years.at(-1)}` : years.join(", ");
}
