import "server-only";

import { PILLARS } from "@/lib/analytics/derive";
import { rankUnits, type RankedUnit } from "@/lib/analytics/ranking";
import { createFactSheetBuilder } from "@/lib/brief/facts";
import type { Country } from "@/lib/countries";
import { loadCountryDataset } from "@/lib/country-landing-data";
import type { Pillar } from "@/types/analytics";

const LIST_LENGTH = 5;

export type CountryPillarSummary = {
  key: Pillar;
  scoreId: string;
  label: string;
  color: string;
  median: number | null;
  distribution: number[];
  change: { previousYear: number | null; points: number | null; comparedUnits: number; totalUnits: number; changedComponents: string[] };
  highest: RankedUnit[];
  lowest: RankedUnit[];
  rankedCount: number;
};

type CountrySummaries = { generatedAt: string; years: number[]; pillars: CountryPillarSummary[] };

// The data changes only with a deploy, so each country's summaries are built once per server.
const cache = new Map<string, Promise<CountrySummaries>>();

export function getCountryPillarSummaries(country: Country): Promise<CountrySummaries> {
  const cached = cache.get(country.slug);
  if (cached) return cached;
  const built = buildCountryPillarSummaries(country);
  cache.set(country.slug, built);
  built.catch(() => cache.delete(country.slug));
  return built;
}

/**
 * The country page's numbers for each pillar: the national median, its comparable change since
 * the previous year (from the fact-sheet builder, so the country page and the brief share one
 * rule), every unit's score, and the five highest and lowest units with their ranks.
 */
async function buildCountryPillarSummaries(country: Country): Promise<CountrySummaries> {
  const dataset = await loadCountryDataset(country);
  const builder = createFactSheetBuilder(dataset, country);
  const latest = dataset.municipalities.filter((unit) => unit.year === dataset.release.year);
  const pillars = PILLARS.map((pillar): CountryPillarSummary => {
    const change = builder.countryChange(pillar.scoreId);
    const ranking = rankUnits(
      latest.map((unit) => ({
        id: unit.id,
        compositeKey: unit.compositeKey,
        name: unit.municipality,
        district: unit.district,
        province: unit.province,
        value: unit.scores[pillar.scoreId] ?? null,
        mapped: true,
      })),
      "",
    );
    const ranked = ranking.rows.filter((row) => row.rank !== null);
    return {
      key: pillar.id,
      scoreId: pillar.scoreId,
      label: pillar.label,
      color: pillar.cssVar,
      median: change.median,
      distribution: builder.scores(pillar.scoreId),
      change: {
        previousYear: change.previousYear,
        points: change.change,
        comparedUnits: change.comparedUnits,
        totalUnits: change.totalUnits,
        changedComponents: change.changedComponents,
      },
      highest: ranked.slice(0, LIST_LENGTH),
      lowest: ranked.slice(-LIST_LENGTH).reverse(),
      rankedCount: ranking.rankedCount,
    };
  });
  return { generatedAt: dataset.generatedAt, years: [...dataset.years].sort((a, b) => a - b), pillars };
}
