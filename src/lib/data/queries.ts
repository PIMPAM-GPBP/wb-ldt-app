import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

import type {
  AiIndicatorSeries,
  AiPipelineContext,
} from "@/lib/ai/types";
import { InvalidAiScopeError } from "@/lib/ai/request";
import {
  defaultCountry,
  getCountryByCode,
  type Country,
  type CountryCode,
} from "@/lib/countries";
import { scoreComponentIndicatorMappings } from "@/lib/data/labels";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AnalyticsDataset,
  AnalyticsFeature,
  AnalyticsPageData,
  IndicatorDefinition,
  MapFeatureCollection,
  MetricDefinition,
  MunicipalityRecord,
  Pillar,
  ScoreDefinition,
  ScoreWaterfallGroup,
} from "@/types/analytics";

const PAGE_SIZE = 1000;
const DEFAULT_MAP_METRIC_ID = "prosperity_score";
const DEFAULT_SCATTER_X_METRIC_ID = "infrastructure_score";
const DEFAULT_SCATTER_Y_METRIC_ID = "prosperity_score";

type SearchParams = Record<string, string | string[] | undefined>;

type ReleaseRow = {
  id: string;
  country_code: CountryCode;
  release_key: string;
  year: number;
  label: string;
  admin_file_name: string | null;
  score_file_name: string | null;
  geojson_file_name: string | null;
  is_active: boolean;
  created_at: string;
};

type MunicipalityRow = {
  id: string;
  country_code: CountryCode;
  municipality: string;
  district: string;
  province: string;
  municipality_slug: string;
  district_slug: string;
  province_slug: string;
  composite_key: string;
};

type ScoreDefinitionRow = {
  id: string;
  canonical_name: string;
  pillar: Pillar;
  description: string | null;
  component_score_keys: string[] | null;
  display_order: number;
};

type IndicatorSourceRow = {
  label: string;
  url: string;
  sort_order: number;
};

type IndicatorRow = {
  id: string;
  canonical_name: string;
  description: string | null;
  higher_is_better: boolean | null;
  pillar: Pillar | null;
  display_order: number;
  indicator_sources?: IndicatorSourceRow[] | null;
};

type ScoreComponentRow = {
  id: string;
  canonical_name: string;
  pillar: Pillar;
  parent_score_id: string;
  display_order: number;
};

type ScoreValueRow = {
  municipality_id: string;
  score_id: string;
  score_value: number | null;
};

type ScoreComponentValueRow = {
  municipality_id: string;
  component_id: string;
  score_value: number | null;
};

type IndicatorValueRow = {
  municipality_id: string;
  indicator_id: string;
  numeric_value: number | null;
};

type ContextValueRow = {
  municipality_id: string;
  population: number | null;
  total_land_area_km2: number | null;
  total_road_length_km: number | null;
  total_railway_length_km: number | null;
  road_flood_risk_km: number | null;
  road_heatwave_risk_km: number | null;
  railway_flood_risk_km: number | null;
  railway_heatwave_risk_km: number | null;
};

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }

  const total = filtered.reduce((sum, value) => sum + value, 0);
  return Number((total / filtered.length).toFixed(2));
}

function normalizeLandAreaKm2(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if ((value as number) > 100000) {
    return Number(((value as number) / 1_000_000).toFixed(2));
  }

  return Number((value as number).toFixed(2));
}

function normalizeMunicipalityContext(
  context: MunicipalityRecord["context"],
): MunicipalityRecord["context"] {
  return {
    ...context,
    totalLandAreaKm2: normalizeLandAreaKm2(context.totalLandAreaKm2),
  };
}

function getSearchValue(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : null;
  return code === "PGRST205" || code === "42P01";
}

function resolveCountry(countryCode: CountryCode | string | undefined): Country {
  return getCountryByCode(countryCode ?? defaultCountry.code) ?? defaultCountry;
}

function getLocalPlanUnitName(country: Country, municipality: MunicipalityRecord) {
  return country.planningDocuments.planSourceAdminLevel === "lower"
    ? municipality.municipality
    : municipality.province;
}

function getLocalPlanUnitLabel(country: Country) {
  return country.planningDocuments.planSourceAdminLevel === "lower"
    ? country.adminLabels.lower.singular
    : country.adminLabels.higher.singular;
}

async function loadLocalPlanCandidatesForSelection(
  country: Country,
  municipality: MunicipalityRecord,
) {
  const localPlanUnitName = getLocalPlanUnitName(country, municipality);
  const localPlanUnitLabel = getLocalPlanUnitLabel(country);

  try {
    const { getProvincePlanCandidatesForProvince } = await import("@/lib/ai/documents");
    const candidates = await getProvincePlanCandidatesForProvince(
      country.code,
      localPlanUnitName,
    );

    return candidates.map((candidate) => ({
      ...candidate,
      planUnitName: localPlanUnitName,
      planUnitLabel: localPlanUnitLabel,
    }));
  } catch (error) {
    console.error(
      `Unable to load ${country.code} local plan candidates for ${localPlanUnitName}:`,
      error,
    );
    return [];
  }
}

const loadLocalAnalyticsFallback = cache(async (countryCode: CountryCode): Promise<AnalyticsDataset> => {
  const country = resolveCountry(countryCode);
  const filePath = path.join(process.cwd(), country.fallbackDataPath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as AnalyticsDataset;
});

const loadMapFeatureCollection = cache(async (countryCode: CountryCode): Promise<MapFeatureCollection> => {
  const country = resolveCountry(countryCode);
  const filePath = path.join(process.cwd(), country.mapDataPath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as MapFeatureCollection;
});

const loadSupabaseBaseData = cache(async (countryCode: CountryCode) => {
  const supabase = getSupabaseServerClient().schema("analytics");

  const scoreComponentResultPromise = supabase
    .from("score_components")
    .select("id, canonical_name, pillar, parent_score_id, display_order")
    .order("parent_score_id", { ascending: true })
    .order("display_order", { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        if (isMissingRelationError(error)) {
          return [] as ScoreComponentRow[];
        }

        throw error;
      }

      return (data ?? []) as ScoreComponentRow[];
    });

  const [releaseResult, municipalityResult, scoreDefinitionResult, indicatorResult, boundaryResult, scoreComponents] =
    await Promise.all([
      supabase
        .from("dataset_releases")
        .select(
          "id, country_code, release_key, year, label, admin_file_name, score_file_name, geojson_file_name, is_active, created_at",
        )
        .eq("country_code", countryCode)
        .order("year", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("municipalities")
        .select(
          "id, country_code, municipality, district, province, municipality_slug, district_slug, province_slug, composite_key",
        )
        .eq("country_code", countryCode)
        .order("province", { ascending: true })
        .order("district", { ascending: true })
        .order("municipality", { ascending: true }),
      supabase
        .from("score_definitions")
        .select(
          "id, canonical_name, pillar, description, component_score_keys, display_order",
        )
        .order("display_order", { ascending: true }),
      supabase
        .from("indicators")
        .select(
          "id, canonical_name, description, higher_is_better, pillar, display_order, indicator_sources(label, url, sort_order)",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("municipality_boundaries")
        .select("municipality_id, municipalities!inner(country_code)", { count: "exact", head: true })
        .eq("municipalities.country_code", countryCode),
      scoreComponentResultPromise,
    ]);

  if (releaseResult.error) {
    throw releaseResult.error;
  }

  if (municipalityResult.error) {
    throw municipalityResult.error;
  }

  if (scoreDefinitionResult.error) {
    throw scoreDefinitionResult.error;
  }

  if (indicatorResult.error) {
    throw indicatorResult.error;
  }

  if (boundaryResult.error) {
    throw boundaryResult.error;
  }

  return {
    releases: (releaseResult.data ?? []) as ReleaseRow[],
    municipalities: (municipalityResult.data ?? []) as MunicipalityRow[],
    scoreDefinitions: (scoreDefinitionResult.data ?? []) as ScoreDefinitionRow[],
    indicators: (indicatorResult.data ?? []) as IndicatorRow[],
    scoreComponents,
    mapMunicipalityCount: boundaryResult.count ?? 0,
  };
});

async function selectAllRows<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

const loadScoreValuesForRelease = cache(async (releaseId: string, year: number) => {
  const supabase = getSupabaseServerClient().schema("analytics");

  return selectAllRows<ScoreValueRow>((from, to) =>
    supabase
      .from("municipality_score_values")
      .select("municipality_id, score_id, score_value")
      .eq("release_id", releaseId)
      .eq("year", year)
      .range(from, to),
  );
});

const loadIndicatorValuesForRelease = cache(
  async (releaseId: string, year: number, indicatorId: string) => {
    const supabase = getSupabaseServerClient().schema("analytics");

    return selectAllRows<IndicatorValueRow>((from, to) =>
      supabase
        .from("municipality_indicator_values")
        .select("municipality_id, indicator_id, numeric_value")
        .eq("release_id", releaseId)
        .eq("year", year)
        .eq("indicator_id", indicatorId)
        .range(from, to),
    );
  },
);

const loadScoreComponentHistory = cache(
  async (
    releases: Array<{ id: string; year: number }>,
    componentId: string,
  ) => {
    const rowsByYear = await Promise.all(
      releases.map(async (release) => ({
        year: release.year,
        rows: await loadScoreComponentValuesForRelease(release.id, release.year),
      })),
    );

    return rowsByYear.map(({ year, rows }) => ({
      year,
      rows: rows.filter((row) => row.component_id === componentId),
    }));
  },
);

const loadScoreComponentValuesForRelease = cache(async (releaseId: string, year: number) => {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    return await selectAllRows<ScoreComponentValueRow>((from, to) =>
      supabase
        .from("municipality_score_component_values")
        .select("municipality_id, component_id, score_value")
        .eq("release_id", releaseId)
        .eq("year", year)
        .range(from, to),
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [] as ScoreComponentValueRow[];
    }

    throw error;
  }
});

const loadContextValuesForRelease = cache(async (releaseId: string, year: number) => {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    return await selectAllRows<ContextValueRow>((from, to) =>
      supabase
        .from("municipality_context_values")
        .select(
          "municipality_id, population, total_land_area_km2, total_road_length_km, total_railway_length_km, road_flood_risk_km, road_heatwave_risk_km, railway_flood_risk_km, railway_heatwave_risk_km",
        )
        .eq("release_id", releaseId)
        .eq("year", year)
        .range(from, to),
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [] as ContextValueRow[];
    }

    throw error;
  }
});

function getMetricValue(municipality: MunicipalityRecord, metric: MetricDefinition) {
  if (metric.kind === "score") {
    return municipality.scores[metric.id] ?? null;
  }

  return municipality.indicators[metric.id] ?? null;
}

function findMetricById(metrics: MetricDefinition[], metricId: string, fallbackId: string) {
  return metrics.find((metric) => metric.id === metricId) ?? metrics.find((metric) => metric.id === fallbackId) ?? metrics[0];
}

function findMunicipalityById(rows: MunicipalityRecord[], municipalityId: string | undefined) {
  if (!municipalityId) {
    return rows[0];
  }

  return (
    rows.find(
      (municipality) =>
        municipality.id === municipalityId ||
        municipality.compositeKey === municipalityId,
    ) ?? rows[0]
  );
}

function buildMetricSummary(municipalities: MunicipalityRecord[], metric: MetricDefinition) {
  const values = municipalities
    .map((municipality) => getMetricValue(municipality, metric))
    .filter((value): value is number => value !== null);

  const minimum = values.length > 0 ? Math.min(...values) : null;
  const maximum = values.length > 0 ? Math.max(...values) : null;

  return {
    minimum,
    maximum,
    average: average(values),
  };
}

function buildNationalComponentAverages(municipalities: MunicipalityRecord[]) {
  const componentIds = new Set<string>();

  for (const municipality of municipalities) {
    for (const componentId of Object.keys(municipality.scoreComponents)) {
      componentIds.add(componentId);
    }
  }

  const averages: Record<string, number | null> = {};
  for (const componentId of componentIds) {
    averages[componentId] = average(
      municipalities.map((municipality) => municipality.scoreComponents[componentId]),
    );
  }

  return averages;
}

function inferScoreDefinition(scoreDefinitions: ScoreDefinition[], metric: MetricDefinition) {
  if (metric.kind === "score") {
    return scoreDefinitions.find((definition) => definition.id === metric.id) ?? scoreDefinitions[0];
  }

  if (metric.pillar) {
    return (
      scoreDefinitions.find((definition) => definition.pillar === metric.pillar) ??
      scoreDefinitions[0]
    );
  }

  return scoreDefinitions[0];
}

function buildMapFeatures(
  featureCollection: MapFeatureCollection,
  municipalitiesByCompositeKey: Map<string, MunicipalityRecord>,
  metric: MetricDefinition,
) {
  return featureCollection.features
    .map((feature) => {
      const municipality = municipalitiesByCompositeKey.get(feature.properties.compositeKey);
      if (!municipality) {
        return null;
      }

      return {
        ...feature,
        metricValue: getMetricValue(municipality, metric),
      } satisfies AnalyticsFeature;
    })
    .filter((feature): feature is AnalyticsFeature => feature !== null);
}

function buildScoreIndex(rows: ScoreValueRow[]) {
  const scoresByMunicipality = new Map<string, Record<string, number | null>>();

  for (const row of rows) {
    const scores = scoresByMunicipality.get(row.municipality_id) ?? {};
    scores[row.score_id] = row.score_value;
    scoresByMunicipality.set(row.municipality_id, scores);
  }

  return scoresByMunicipality;
}

function buildIndicatorIndex(rows: IndicatorValueRow[]) {
  const indicatorsByMunicipality = new Map<string, Record<string, number | null>>();

  for (const row of rows) {
    const indicators = indicatorsByMunicipality.get(row.municipality_id) ?? {};
    indicators[row.indicator_id] = row.numeric_value;
    indicatorsByMunicipality.set(row.municipality_id, indicators);
  }

  return indicatorsByMunicipality;
}

function buildScoreComponentIndex(rows: ScoreComponentValueRow[]) {
  const componentsByMunicipality = new Map<string, Record<string, number | null>>();

  for (const row of rows) {
    const components = componentsByMunicipality.get(row.municipality_id) ?? {};
    components[row.component_id] = row.score_value;
    componentsByMunicipality.set(row.municipality_id, components);
  }

  return componentsByMunicipality;
}

function buildContextIndex(rows: ContextValueRow[]) {
  const contextByMunicipality = new Map<string, MunicipalityRecord["context"]>();

  for (const row of rows) {
    contextByMunicipality.set(row.municipality_id, {
      population: row.population,
      totalLandAreaKm2: normalizeLandAreaKm2(row.total_land_area_km2),
      totalRoadLengthKm: row.total_road_length_km,
      totalRailwayLengthKm: row.total_railway_length_km,
      roadFloodRiskKm: row.road_flood_risk_km,
      roadHeatwaveRiskKm: row.road_heatwave_risk_km,
      railwayFloodRiskKm: row.railway_flood_risk_km,
      railwayHeatwaveRiskKm: row.railway_heatwave_risk_km,
    });
  }

  return contextByMunicipality;
}

function buildProvinceSummary(municipalities: MunicipalityRecord[], scoreDefinitions: ScoreDefinition[]) {
  const grouped = new Map<string, MunicipalityRecord[]>();

  for (const municipality of municipalities) {
    const existing = grouped.get(municipality.province) ?? [];
    existing.push(municipality);
    grouped.set(municipality.province, existing);
  }

  return [...grouped.entries()]
    .map(([province, rows]) => {
      const averageScores: Record<string, number | null> = {};

      for (const definition of scoreDefinitions) {
        averageScores[definition.id] = average(
          rows.map((row) => row.scores[definition.id]),
        );
      }

      return {
        province,
        municipalityCount: rows.length,
        averageScores,
      };
    })
    .sort((left, right) => left.province.localeCompare(right.province));
}

async function buildAiIndicatorSeries({
  scoreDefinition,
  municipality,
  releases,
  municipalities,
}: {
  scoreDefinition: ScoreDefinition;
  municipality: MunicipalityRecord;
  releases: Array<{ id: string; year: number }>;
  municipalities: MunicipalityRecord[];
}) {
  const sameProvinceMunicipalities = municipalities.filter(
    (candidate) => candidate.province === municipality.province,
  );

  const series = await Promise.all(
    scoreDefinition.componentIds.map(async (componentId, index) => {
      const indicatorId =
        scoreComponentIndicatorMappings[
          componentId as keyof typeof scoreComponentIndicatorMappings
        ] ?? componentId;

      const history = await loadScoreComponentHistory(releases, componentId);

      return {
        componentId,
        indicatorId,
        label: scoreDefinition.componentLabels[index] ?? componentId,
        description: null,
        points: history.map(({ year, rows }) => {
          const componentValues = buildScoreComponentIndex(rows);
          const municipalityValue =
            componentValues.get(municipality.id)?.[componentId] ?? null;

          const provinceAverage = average(
            sameProvinceMunicipalities.map(
              (candidate) => componentValues.get(candidate.id)?.[componentId] ?? null,
            ),
          );
          const nationalAverage = average(
            municipalities.map(
              (candidate) => componentValues.get(candidate.id)?.[componentId] ?? null,
            ),
          );

          return {
            year,
            municipalityValue,
            provinceAverage,
            nationalAverage,
          };
        }),
        singleYearOnly: history.length <= 1,
      } satisfies AiIndicatorSeries;
    }),
  );

  return series.filter((item) => item !== null) as AiIndicatorSeries[];
}

function pickReleaseForYear(releases: ReleaseRow[], requestedYear: number) {
  const rowsForYear = releases.filter((release) => release.year === requestedYear);
  if (rowsForYear.length === 0) {
    return null;
  }

  return rowsForYear.find((release) => release.is_active) ?? rowsForYear[0];
}

export async function getAnalyticsPageData(
  rawSearchParams: Promise<SearchParams> | SearchParams,
  countryCode: CountryCode = defaultCountry.code,
): Promise<AnalyticsPageData> {
  const country = resolveCountry(countryCode);
  const searchParams = await rawSearchParams;
  const selectedTab = getSearchValue(searchParams.tab, "multi");
  const shouldBuildMapData = selectedTab === "single";
  const shouldBuildComponentData = selectedTab === "single" || selectedTab === "ai";
  const shouldBuildAiSeries = selectedTab === "ai";
  const [baseData, localFallback, featureCollection] = await Promise.all([
    loadSupabaseBaseData(country.code),
    loadLocalAnalyticsFallback(country.code),
    shouldBuildMapData
      ? loadMapFeatureCollection(country.code)
      : Promise.resolve({ type: "FeatureCollection", features: [] } satisfies MapFeatureCollection),
  ]);

  if (baseData.releases.length === 0) {
    throw new Error("No analytics releases found in Supabase.");
  }

  const years = [...new Set(baseData.releases.map((release) => release.year))].sort((a, b) => a - b);
  const activeRelease =
    baseData.releases.find((release) => release.is_active) ??
    pickReleaseForYear(baseData.releases, years[years.length - 1] ?? 2025) ??
    baseData.releases[0];

  const requestedYear = Number(getSearchValue(searchParams.year, String(activeRelease.year)));
  const selectedRelease = pickReleaseForYear(baseData.releases, requestedYear) ?? activeRelease;
  const selectedYear = selectedRelease.year;

  const fallbackScoreDefinitionsById = new Map(
    localFallback.scoreDefinitions.map((definition) => [definition.id, definition]),
  );
  const scoreComponentRowsByParentId = new Map<string, ScoreComponentRow[]>();
  for (const row of baseData.scoreComponents) {
    const existing = scoreComponentRowsByParentId.get(row.parent_score_id) ?? [];
    existing.push(row);
    scoreComponentRowsByParentId.set(row.parent_score_id, existing);
  }
  const fallbackMunicipalitiesByCompositeKey = new Map(
    localFallback.municipalities.map((municipality) => [municipality.compositeKey, municipality]),
  );
  const fallbackMapFeatureKeys = new Set(localFallback.mapFeatureKeys);

  const scoreDefinitions = baseData.scoreDefinitions.map((definition) => {
    const fallback = fallbackScoreDefinitionsById.get(definition.id);
    const componentRows = scoreComponentRowsByParentId.get(definition.id) ?? [];

    return {
      id: definition.id,
      label: definition.canonical_name,
      pillar: definition.pillar,
      componentLabels:
        componentRows.length > 0
          ? componentRows.map((row) => row.canonical_name)
          : fallback?.componentLabels ?? definition.component_score_keys ?? [],
      componentIds:
        componentRows.length > 0
          ? componentRows.map((row) => row.id)
          : fallback?.componentIds ?? definition.component_score_keys ?? [],
      sortOrder: definition.display_order,
    } satisfies ScoreDefinition;
  });

  const indicatorDefinitions = baseData.indicators.map((indicator) => ({
    id: indicator.id,
    label: indicator.canonical_name,
    description: indicator.description,
    higherIsBetter: indicator.higher_is_better,
    pillar: indicator.pillar,
    sortOrder: indicator.display_order,
    sources: [...(indicator.indicator_sources ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((source) => ({
        label: source.label,
        url: source.url,
      })),
  })) satisfies IndicatorDefinition[];

  const metrics = [
    ...scoreDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      kind: "score" as const,
      pillar: definition.pillar,
    })),
    ...indicatorDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      kind: "indicator" as const,
      pillar: definition.pillar,
      higherIsBetter: definition.higherIsBetter,
    })),
  ] satisfies MetricDefinition[];

  const availableProvinces = [
    "all",
    ...[...new Set(baseData.municipalities.map((municipality) => municipality.province))].sort(),
  ];
  const requestedProvince = getSearchValue(searchParams.province, "all");
  const selectedProvince = availableProvinces.includes(requestedProvince)
    ? requestedProvince
    : "all";

  const scoreMetrics = metrics.filter((metric) => metric.kind === "score");
  const selectedMapMetric = findMetricById(
    metrics,
    getSearchValue(searchParams.metric, DEFAULT_MAP_METRIC_ID),
    DEFAULT_MAP_METRIC_ID,
  );
  const selectedXMetric = findMetricById(
    scoreMetrics,
    getSearchValue(searchParams.x, DEFAULT_SCATTER_X_METRIC_ID),
    DEFAULT_SCATTER_X_METRIC_ID,
  );
  const selectedYMetric = findMetricById(
    scoreMetrics,
    getSearchValue(searchParams.y, DEFAULT_SCATTER_Y_METRIC_ID),
    DEFAULT_SCATTER_Y_METRIC_ID,
  );
  const selectedAiScore = findMetricById(
    scoreMetrics,
    getSearchValue(searchParams.ai_score, DEFAULT_MAP_METRIC_ID),
    DEFAULT_MAP_METRIC_ID,
  );

  const [scoreValueRows, indicatorValueRows, scoreComponentValueRows, contextValueRows] = await Promise.all([
    loadScoreValuesForRelease(selectedRelease.id, selectedYear),
    shouldBuildMapData && selectedMapMetric.kind === "indicator"
      ? loadIndicatorValuesForRelease(selectedRelease.id, selectedYear, selectedMapMetric.id)
      : Promise.resolve([] as IndicatorValueRow[]),
    shouldBuildComponentData
      ? loadScoreComponentValuesForRelease(selectedRelease.id, selectedYear)
      : Promise.resolve([] as ScoreComponentValueRow[]),
    loadContextValuesForRelease(selectedRelease.id, selectedYear),
  ]);

  const scoreIndex = buildScoreIndex(scoreValueRows);
  const indicatorIndex = buildIndicatorIndex(indicatorValueRows);
  const scoreComponentIndex = buildScoreComponentIndex(scoreComponentValueRows);
  const contextIndex = buildContextIndex(contextValueRows);

  const municipalitiesForYear = baseData.municipalities.map((municipality) => {
    const fallback = fallbackMunicipalitiesByCompositeKey.get(municipality.composite_key);
    const scores = scoreIndex.get(municipality.id) ?? {};
    const indicators = indicatorIndex.get(municipality.id) ?? {};

    return {
      id: municipality.id,
      municipality: municipality.municipality,
      district: municipality.district,
      province: municipality.province,
      compositeKey: municipality.composite_key,
      slug: {
        municipality: municipality.municipality_slug,
        district: municipality.district_slug,
        province: municipality.province_slug,
      },
      year: selectedYear,
      mapAvailable: fallbackMapFeatureKeys.has(municipality.composite_key),
      indicators,
      scoreComponents:
        scoreComponentIndex.get(municipality.id) ?? fallback?.scoreComponents ?? {},
      scores,
      context: normalizeMunicipalityContext(
        contextIndex.get(municipality.id) ??
          fallback?.context ??
          {
            population: null,
            totalLandAreaKm2: null,
            totalRoadLengthKm: null,
            totalRailwayLengthKm: null,
            roadFloodRiskKm: null,
            roadHeatwaveRiskKm: null,
            railwayFloodRiskKm: null,
            railwayHeatwaveRiskKm: null,
          },
      ),
    } satisfies MunicipalityRecord;
  });

  const provinceFilteredMunicipalities =
    selectedProvince === "all"
      ? municipalitiesForYear
      : municipalitiesForYear.filter(
          (municipality) => municipality.province === selectedProvince,
        );

  const selectedMunicipality =
    findMunicipalityById(
      provinceFilteredMunicipalities,
      getSearchValue(searchParams.municipality, provinceFilteredMunicipalities[0]?.id ?? municipalitiesForYear[0]?.id ?? ""),
    ) ??
    municipalitiesForYear[0];

  if (!selectedMunicipality) {
    throw new Error("No municipalities available for the selected release.");
  }

  const municipalitiesByCompositeKey = new Map(
    municipalitiesForYear.map((municipality) => [municipality.compositeKey, municipality]),
  );

  const mapFeatures = shouldBuildMapData
    ? buildMapFeatures(
        featureCollection,
        municipalitiesByCompositeKey,
        selectedMapMetric,
      ).filter((feature) =>
        selectedProvince === "all"
          ? true
          : feature.properties.Province === selectedProvince,
      )
    : [];

  const metricSummary = buildMetricSummary(provinceFilteredMunicipalities, selectedMapMetric);
  const nationalComponentAverages = shouldBuildComponentData
    ? buildNationalComponentAverages(municipalitiesForYear)
    : {};
  const selectedScoreDefinition = inferScoreDefinition(scoreDefinitions, selectedMapMetric);
  const scoreComponentDefinitions = shouldBuildComponentData
    ? selectedScoreDefinition.componentIds.map((componentId, index) => {
        const indicatorId =
          scoreComponentIndicatorMappings[
            componentId as keyof typeof scoreComponentIndicatorMappings
          ];
        const indicatorDefinition = indicatorDefinitions.find(
          (definition) => definition.id === indicatorId,
        );

        return {
          id: componentId,
          label: selectedScoreDefinition.componentLabels[index] ?? componentId,
          description: indicatorDefinition?.description ?? null,
        };
      })
    : [];

  const scoreDriverRows = shouldBuildComponentData
    ? selectedScoreDefinition.componentIds.map((componentId, index) => {
        const municipalityValue = selectedMunicipality.scoreComponents[componentId] ?? null;
        const nationalValue = nationalComponentAverages[componentId] ?? null;

        return {
          componentId,
          label: selectedScoreDefinition.componentLabels[index] ?? componentId,
          municipalityValue,
          nationalValue,
          delta:
            municipalityValue !== null && nationalValue !== null
              ? Number((municipalityValue - nationalValue).toFixed(2))
              : null,
        };
      })
    : [];

  const nationalScoreAverages: Record<string, number | null> = {};
  for (const definition of scoreDefinitions) {
    nationalScoreAverages[definition.id] = average(
      municipalitiesForYear.map((municipality) => municipality.scores[definition.id]),
    );
  }

  const waterfalls = shouldBuildComponentData ? scoreDefinitions.map((definition) => {
    const validComponentCount = Math.max(
      definition.componentIds.filter((componentId) => {
        const municipalityValue = selectedMunicipality.scoreComponents[componentId] ?? null;
        const nationalValue = nationalComponentAverages[componentId] ?? null;
        return Number.isFinite(municipalityValue) && Number.isFinite(nationalValue);
      }).length,
      1,
    );

    const rows = definition.componentIds.map((componentId, index) => {
      const indicatorId =
        scoreComponentIndicatorMappings[
          componentId as keyof typeof scoreComponentIndicatorMappings
        ];
      const indicatorDefinition = indicatorDefinitions.find(
        (candidate) => candidate.id === indicatorId,
      );
      const municipalityValue = selectedMunicipality.scoreComponents[componentId] ?? null;
      const nationalValue = nationalComponentAverages[componentId] ?? null;
      const delta =
        Number.isFinite(municipalityValue) && Number.isFinite(nationalValue)
          ? (municipalityValue as number) - (nationalValue as number)
          : null;

      return {
        componentId,
        label: definition.componentLabels[index] ?? componentId,
        description: indicatorDefinition?.description ?? null,
        municipalityValue,
        nationalValue,
        contribution:
          delta === null ? null : Number((delta / validComponentCount).toFixed(2)),
      };
    });

    const totalDifference = rows.reduce(
      (sum, row) => sum + (row.contribution ?? 0),
      0,
    );

    return {
      scoreId: definition.id,
      scoreLabel: definition.label,
      municipalityScore: selectedMunicipality.scores[definition.id] ?? null,
      nationalScore: nationalScoreAverages[definition.id] ?? null,
      totalDifference:
        Number.isFinite(selectedMunicipality.scores[definition.id]) &&
        Number.isFinite(nationalScoreAverages[definition.id])
          ? Number(
              (
                (selectedMunicipality.scores[definition.id] as number) -
                (nationalScoreAverages[definition.id] as number)
              ).toFixed(2),
            )
          : Number(totalDifference.toFixed(2)),
      rows,
    } satisfies ScoreWaterfallGroup;
  }) : [];

  const aiScoreDefinition =
    scoreDefinitions.find((definition) => definition.id === selectedAiScore.id) ??
    scoreDefinitions[0];
  const aiIndicatorSeries = shouldBuildAiSeries
    ? await buildAiIndicatorSeries({
        scoreDefinition: aiScoreDefinition,
        municipality: selectedMunicipality,
        releases: years
          .map((year) => pickReleaseForYear(baseData.releases, year))
          .filter((release): release is ReleaseRow => release !== null)
          .map((release) => ({
            id: release.id,
            year: release.year,
          })),
        municipalities: municipalitiesForYear,
      })
    : [];
  const aiIndicatorSeriesWithDescriptions = aiIndicatorSeries.map((series) => ({
    ...series,
    description:
      indicatorDefinitions.find((definition) => definition.id === series.indicatorId)
        ?.description ?? null,
  }));
  const localPlanUnitName = getLocalPlanUnitName(country, selectedMunicipality);
  const localPlanUnitLabel = getLocalPlanUnitLabel(country);
  const localPlanCandidates =
    shouldBuildAiSeries && country.planningDocuments.aiEnabled
      ? await loadLocalPlanCandidatesForSelection(country, selectedMunicipality)
      : [];
  const localPlanUnavailableMessage =
    shouldBuildAiSeries &&
    country.planningDocuments.aiEnabled &&
    localPlanCandidates.length === 0
      ? `No local/SNG plan URL is available for ${localPlanUnitName}. Score narrative and national-plan context can still run, but alignment, SWOT, and recommendations need a local plan.`
      : null;
  const nationalIndicatorAverages: Record<string, number | null> = {};
  if (selectedMapMetric.kind === "indicator") {
    nationalIndicatorAverages[selectedMapMetric.id] = average(
      municipalitiesForYear.map((municipality) => municipality.indicators[selectedMapMetric.id]),
    );
  }

  return {
    country: {
      code: country.code,
      slug: country.slug,
      name: country.name,
    },
    release: {
      countryCode: country.code,
      key: selectedRelease.release_key,
      year: selectedRelease.year,
      adminFileName: selectedRelease.admin_file_name ?? localFallback.release.adminFileName,
      scoreFileName: selectedRelease.score_file_name ?? localFallback.release.scoreFileName,
      geojsonFileName: selectedRelease.geojson_file_name ?? localFallback.release.geojsonFileName,
      indicatorWorkbookFileName: localFallback.release.indicatorWorkbookFileName,
    },
    nationalAverages: {
      indicators: nationalIndicatorAverages,
      scores: nationalScoreAverages,
    },
    filters: {
      years,
      provinces: availableProvinces,
      metrics,
      scoreMetrics,
      municipalities: provinceFilteredMunicipalities
        .map((municipality) => ({
          id: municipality.id,
          label: `${municipality.municipality}, ${municipality.district}`,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
    coverage: {
      analyticsMunicipalityCount: municipalitiesForYear.length,
      mapMunicipalityCount: baseData.mapMunicipalityCount,
      analyticsOnlyCount: municipalitiesForYear.length - baseData.mapMunicipalityCount,
      boundaryOnlyCount: localFallback.coverage.boundaryOnlyCount,
    },
    selected: {
      year: selectedYear,
      province: selectedProvince,
      municipalityId: selectedMunicipality.id,
      municipalityName: selectedMunicipality.municipality,
      metricId: selectedMapMetric.id,
      xMetricId: selectedXMetric.id,
      yMetricId: selectedYMetric.id,
      aiScoreId: aiScoreDefinition.id,
    },
    municipality: selectedMunicipality,
    map: {
      metric: selectedMapMetric,
      features: mapFeatures,
      summary: metricSummary,
      coverageLabel: `${baseData.mapMunicipalityCount} mapped of ${municipalitiesForYear.length} analytics municipalities`,
    },
    scatter2d: {
      xMetric: selectedXMetric,
      yMetric: selectedYMetric,
      points: provinceFilteredMunicipalities.map((municipality) => ({
        id: municipality.id,
        label: municipality.municipality,
        district: municipality.district,
        province: municipality.province,
        x: municipality.scores[selectedXMetric.id] ?? null,
        y: municipality.scores[selectedYMetric.id] ?? null,
        selected: municipality.id === selectedMunicipality.id,
      })),
    },
    scatter3d: {
      points: provinceFilteredMunicipalities.map((municipality) => ({
        id: municipality.id,
        label: municipality.municipality,
        district: municipality.district,
        province: municipality.province,
        x: municipality.scores.prosperity_score ?? null,
        y: municipality.scores.infrastructure_score ?? null,
        z: municipality.scores.livability_score ?? null,
        selected: municipality.id === selectedMunicipality.id,
      })),
    },
    metadata: {
      selectedMetric:
        indicatorDefinitions.find((definition) => definition.id === selectedMapMetric.id) ??
        null,
      scoreDefinition:
        scoreDefinitions.find((definition) => definition.id === selectedMapMetric.id) ??
        inferScoreDefinition(scoreDefinitions, selectedMapMetric),
      scoreComponents: scoreComponentDefinitions,
      scoreDriverRows,
    },
    waterfalls,
    provinceSummary: buildProvinceSummary(municipalitiesForYear, scoreDefinitions),
    ai: {
      scoreOptions: scoreDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.label,
      })),
      selectedScoreId: aiScoreDefinition.id,
      indicatorSeries: aiIndicatorSeriesWithDescriptions,
      cachedStages: {},
      provincePlanCandidates: localPlanCandidates,
      localPlanUnitName,
      localPlanUnitLabel,
      localPlanAvailable: localPlanCandidates.length > 0,
      localPlanUnavailableMessage,
    },
  } satisfies AnalyticsPageData;
}

export async function getMethodologyData() {
  const [baseData, localFallback] = await Promise.all([
    loadSupabaseBaseData(defaultCountry.code),
    loadLocalAnalyticsFallback(defaultCountry.code),
  ]);
  const scoreComponentRowsByParentId = new Map<string, ScoreComponentRow[]>();
  for (const row of baseData.scoreComponents) {
    const existing = scoreComponentRowsByParentId.get(row.parent_score_id) ?? [];
    existing.push(row);
    scoreComponentRowsByParentId.set(row.parent_score_id, existing);
  }

  return {
    indicatorDefinitions: baseData.indicators.map((indicator) => ({
      id: indicator.id,
      label: indicator.canonical_name,
      description: indicator.description,
      higherIsBetter: indicator.higher_is_better,
      pillar: indicator.pillar,
      sortOrder: indicator.display_order,
      sources: [...(indicator.indicator_sources ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((source) => ({
          label: source.label,
          url: source.url,
        })),
    })),
    scoreDefinitions: baseData.scoreDefinitions.map((definition) => {
      const fallback = localFallback.scoreDefinitions.find((item) => item.id === definition.id);
      const componentRows = scoreComponentRowsByParentId.get(definition.id) ?? [];

      return {
        id: definition.id,
        label: definition.canonical_name,
        pillar: definition.pillar,
        componentLabels:
          componentRows.length > 0
            ? componentRows.map((row) => row.canonical_name)
            : fallback?.componentLabels ?? definition.component_score_keys ?? [],
        componentIds:
          componentRows.length > 0
            ? componentRows.map((row) => row.id)
            : fallback?.componentIds ?? definition.component_score_keys ?? [],
        sortOrder: definition.display_order,
      } satisfies ScoreDefinition;
    }),
    metrics: [
      ...baseData.scoreDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.canonical_name,
        kind: "score" as const,
        pillar: definition.pillar,
      })),
      ...baseData.indicators.map((indicator) => ({
        id: indicator.id,
        label: indicator.canonical_name,
        kind: "indicator" as const,
        pillar: indicator.pillar,
        higherIsBetter: indicator.higher_is_better,
      })),
    ] satisfies MetricDefinition[],
    coverage: {
      analyticsMunicipalityCount: baseData.municipalities.length,
      mapMunicipalityCount: baseData.mapMunicipalityCount,
      analyticsOnlyCount: baseData.municipalities.length - baseData.mapMunicipalityCount,
      boundaryOnlyCount: localFallback.coverage.boundaryOnlyCount,
    },
  };
}

export async function getAiPipelineContextForRequest({
  countryCode,
  releaseKey,
  year,
  municipalityId,
  scoreId,
  includeProvincePlanCandidates = false,
}: {
  countryCode: CountryCode;
  releaseKey: string;
  year: number;
  municipalityId: string;
  scoreId: string;
  includeProvincePlanCandidates?: boolean;
}): Promise<AiPipelineContext> {
  const pageData = await getAnalyticsPageData({
    year: String(year),
    municipality: municipalityId,
    ai_score: scoreId,
    tab: "ai",
  }, countryCode);

  if (
    pageData.release.key !== releaseKey ||
    pageData.release.year !== year ||
    pageData.municipality.id !== municipalityId ||
    pageData.ai.selectedScoreId !== scoreId
  ) {
    throw new InvalidAiScopeError();
  }

  const provincePlanCandidates = includeProvincePlanCandidates
    ? await import("@/lib/ai/documents").then((module) =>
        module.getProvincePlanCandidatesForProvince(
          pageData.country.code,
          pageData.ai.localPlanUnitName,
        ),
      )
    : [];

  const selectedScore = pageData.ai.scoreOptions.find(
    (option) => option.id === pageData.ai.selectedScoreId,
  );

  if (!selectedScore) {
    throw new InvalidAiScopeError();
  }

  return {
    country: pageData.country,
    releaseKey: pageData.release.key,
    year: pageData.release.year,
    municipality: {
      id: pageData.municipality.id,
      name: pageData.municipality.municipality,
      district: pageData.municipality.district,
      province: pageData.municipality.province,
    },
    score: {
      id: selectedScore.id,
      label: selectedScore.label,
    },
    indicatorSeries: pageData.ai.indicatorSeries,
    waterfalls: pageData.waterfalls,
    provincePlanCandidates: provincePlanCandidates.map((candidate) => ({
      ...candidate,
      planUnitName: pageData.ai.localPlanUnitName,
      planUnitLabel: pageData.ai.localPlanUnitLabel,
    })),
    localPlanUnitName: pageData.ai.localPlanUnitName,
    localPlanUnitLabel: pageData.ai.localPlanUnitLabel,
    localPlanAvailable: pageData.ai.localPlanAvailable,
  };
}
