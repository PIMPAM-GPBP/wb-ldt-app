import type { SngDisplayRow } from "@/components/nepal/sng-display-section";
import type { CountryHomeGroup } from "@/lib/country-home";
import type { Country } from "@/lib/countries";
import { loadLocalAnalyticsDataset } from "@/lib/data/local-analytics-dataset";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsDataset, MunicipalityRecord } from "@/types/analytics";

export type LocalPlanSource = {
  planUnitName: string;
  title: string;
  link: string;
};

type LocalPlanSourceRow = {
  province: string | null;
  title: string;
  link: string;
};

export type PlanAvailabilityUnit = {
  name: string;
  title: string | null;
  link: string | null;
  hasPlanSource: boolean;
};

export type PlanAvailabilityGroup = {
  name: string;
  lowerUnitCount: number;
  sourceCount: number;
  hasPlanSource: boolean;
  statusLabel: string;
  units: PlanAvailabilityUnit[];
};

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export async function loadCountryDataset(country: Country) {
  return loadLocalAnalyticsDataset(country.fallbackDataPath);
}

export function normalizePlanKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function latestRows(dataset: AnalyticsDataset) {
  const latestYear = Math.max(dataset.release.year, ...dataset.years);
  const rows = dataset.municipalities.filter((municipality) => municipality.year === latestYear);

  return rows.length > 0 ? rows : dataset.municipalities;
}

function averageScore(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => Number.isFinite(value));

  if (numericValues.length === 0) {
    return null;
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return Number((total / numericValues.length).toFixed(2));
}

function getPlanUnitName(country: Country, row: MunicipalityRecord) {
  return country.planningDocuments.planSourceAdminLevel === "lower"
    ? row.municipality
    : row.province;
}

export async function loadLocalPlanSources(country: Country): Promise<LocalPlanSource[]> {
  try {
    const supabase = getSupabaseServerClient().schema("analytics");
    const { data, error } = await supabase
      .from("plan_document_sources")
      .select("province, title, link")
      .eq("country_code", country.code)
      .eq("plan_level", "province")
      .eq("is_active", true)
      .order("province", { ascending: true })
      .order("priority", { ascending: true });

    if (error) {
      return [];
    }

    const seen = new Set<string>();
    const sources: LocalPlanSource[] = [];

    for (const row of (data ?? []) as LocalPlanSourceRow[]) {
      if (!row.province || !row.link) {
        continue;
      }

      const key = normalizePlanKey(row.province);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      sources.push({
        planUnitName: row.province,
        title: row.title,
        link: row.link,
      });
    }

    return sources;
  } catch {
    return [];
  }
}

export function buildPlanSourceMap(sources: LocalPlanSource[]) {
  return new Map(sources.map((source) => [normalizePlanKey(source.planUnitName), source]));
}

export function buildSngRows(
  country: Country,
  dataset: AnalyticsDataset,
  planSourcesByUnit: Map<string, LocalPlanSource>,
): SngDisplayRow[] {
  return latestRows(dataset)
    .map((row) => {
      const planUnitName = getPlanUnitName(country, row);
      const planSource = planSourcesByUnit.get(normalizePlanKey(planUnitName)) ?? null;
      const infrastructureScore = row.scores.infrastructure_score ?? null;
      const livabilityScore = row.scores.livability_score ?? null;
      const prosperityScore = row.scores.prosperity_score ?? null;

      return {
        rowKey: `${country.code}-${row.compositeKey}`,
        municipality: row.municipality,
        province: row.province,
        population: row.context.population,
        totalLandAreaKm2: row.context.totalLandAreaKm2,
        infrastructureScore,
        livabilityScore,
        prosperityScore,
        pilAggregate: averageScore([
          infrastructureScore,
          livabilityScore,
          prosperityScore,
        ]),
        hasDevelopmentStrategy: Boolean(planSource),
        strategyLevel: planSource
          ? country.planningDocuments.planSourceAdminLevel === "lower"
            ? country.adminLabels.lower.singular
            : country.adminLabels.higher.singular
          : null,
        link: planSource?.link ?? null,
      };
    })
    .sort((left, right) => left.municipality.localeCompare(right.municipality));
}

export function buildPlanAvailabilityGroups(
  country: Country,
  groups: CountryHomeGroup[],
  planSourcesByUnit: Map<string, LocalPlanSource>,
): PlanAvailabilityGroup[] {
  const lowerPluralLabel = lowerFirst(country.adminLabels.lower.plural);

  return groups.map((group) => {
    const sourceCount =
      country.planningDocuments.planSourceAdminLevel === "higher"
        ? Number(planSourcesByUnit.has(normalizePlanKey(group.name)))
        : group.lowerUnits.filter((unitName) => planSourcesByUnit.has(normalizePlanKey(unitName))).length;
    const hasPlanSource = sourceCount > 0;
    const statusLabel =
      country.planningDocuments.planSourceAdminLevel === "higher"
        ? hasPlanSource
          ? `${group.name} has an available plan source`
          : `${group.name} does not have an available plan source`
        : `${sourceCount} of ${group.lowerUnits.length} ${lowerPluralLabel} have available local/SNG plan sources`;

    return {
      name: group.name,
      lowerUnitCount: group.lowerUnits.length,
      sourceCount,
      hasPlanSource,
      statusLabel,
      units: group.lowerUnits.map((unitName) => {
        const source = planSourcesByUnit.get(normalizePlanKey(unitName)) ?? null;

        return {
          name: unitName,
          title: source?.title ?? null,
          link: source?.link ?? null,
          hasPlanSource: Boolean(source),
        };
      }),
    };
  });
}
