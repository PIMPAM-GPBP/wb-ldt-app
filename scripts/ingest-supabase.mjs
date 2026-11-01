import { createClient } from "@supabase/supabase-js";

import {
  ADMIN_CANONICAL_MAPPINGS,
  buildCountryAnalyticsData,
  buildReleaseForYear,
  getCountryConfigs,
} from "./lib/nepal-data.mjs";
import { loadLocalEnv } from "./lib/load-env.mjs";

await loadLocalEnv();

const DEFAULT_CHUNK_SIZE = 1000;

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function isMissingRelationError(error) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function uniqueBy(items, getKey) {
  return [...new Map(items.map((item) => [getKey(item), item])).values()];
}

function chunkRows(rows, size = DEFAULT_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function upsertRows(table, rows, options, chunkSize = DEFAULT_CHUNK_SIZE) {
  for (const chunk of chunkRows(rows, chunkSize)) {
    const { error } = await supabase
      .schema("analytics")
      .from(table)
      .upsert(chunk, options);

    if (error) {
      throw error;
    }
  }
}

async function insertRows(table, rows, chunkSize = DEFAULT_CHUNK_SIZE) {
  for (const chunk of chunkRows(rows, chunkSize)) {
    const { error } = await supabase.schema("analytics").from(table).insert(chunk);

    if (error) {
      throw error;
    }
  }
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const countryArg = getArgValue("--country", "NPL");
const configs = getCountryConfigs(countryArg);
const firstAnalyticsData = await buildCountryAnalyticsData(configs[0].code);
const rawAdminColumnByCanonicalLabel = Object.fromEntries(
  Object.entries(ADMIN_CANONICAL_MAPPINGS).map(([raw, canonical]) => [
    canonical,
    raw,
  ]),
);

const indicatorPayload = firstAnalyticsData.indicatorDefinitions.map((indicator) => ({
  id: indicator.id,
  canonical_name: indicator.label,
  raw_admin_column: rawAdminColumnByCanonicalLabel[indicator.label] ?? null,
  description: indicator.description,
  higher_is_better: indicator.higherIsBetter,
  pillar: indicator.pillar,
  display_order: indicator.sortOrder,
}));

const { error: indicatorError } = await supabase
  .schema("analytics")
  .from("indicators")
  .upsert(indicatorPayload, { onConflict: "id" });

if (indicatorError) {
  throw indicatorError;
}

const scoreComponentPayload = firstAnalyticsData.scoreDefinitions.flatMap((definition) =>
  definition.componentIds.map((componentId, index) => ({
    id: componentId,
    canonical_name: definition.componentLabels[index] ?? componentId,
    pillar: definition.pillar,
    parent_score_id: definition.id,
    display_order: index + 1,
  })),
);

const { error: scoreComponentError } = await supabase
  .schema("analytics")
  .from("score_components")
  .upsert(scoreComponentPayload, { onConflict: "id" });

if (scoreComponentError) {
  if (isMissingRelationError(scoreComponentError)) {
    throw new Error(
      "Missing analytics.score_components. Apply supabase/migrations/0003_component_and_context_tables.sql and rerun npm run ingest:supabase.",
    );
  }
  throw scoreComponentError;
}

// score_definitions.component_score_keys lists the same grouping, so keep it in step.
for (const definition of firstAnalyticsData.scoreDefinitions) {
  const { error: scoreKeysError } = await supabase
    .schema("analytics")
    .from("score_definitions")
    .update({ component_score_keys: definition.componentIds })
    .eq("id", definition.id);

  if (scoreKeysError) {
    throw scoreKeysError;
  }
}

const sourcePayload = firstAnalyticsData.indicatorDefinitions.flatMap((indicator) =>
  indicator.sources.map((source, index) => ({
    indicator_id: indicator.id,
    label: source.label,
    url: source.url,
    sort_order: index,
  })),
);

await supabase.schema("analytics").from("indicator_sources").delete().gt("id", 0);
await insertRows("indicator_sources", sourcePayload);

for (const config of configs) {
  const analyticsData =
    config.code === configs[0].code
      ? firstAnalyticsData
      : await buildCountryAnalyticsData(config.code);
  const latestYear = analyticsData.years[analyticsData.years.length - 1];
  const releasePayload = analyticsData.years.map((year) => {
    const release = buildReleaseForYear(config, year);

    return {
      country_code: config.code,
      release_key: release.key,
      year: release.year,
      label: `${config.name} LDT ${release.year}`,
      admin_file_name: release.adminFileName,
      score_file_name: release.scoreFileName,
      geojson_file_name: release.geojsonFileName,
      is_active: release.year === latestYear,
    };
  });

  const { data: releaseRows, error: releaseError } = await supabase
    .schema("analytics")
    .from("dataset_releases")
    .upsert(releasePayload, { onConflict: "country_code,release_key" })
    .select("id, year");

  if (releaseError) {
    throw releaseError;
  }

  const releaseIdByYear = new Map(releaseRows.map((row) => [row.year, row.id]));
  const municipalities = uniqueBy(
    analyticsData.municipalities,
    (municipality) => municipality.compositeKey,
  );
  const municipalitiesPayload = municipalities.map((municipality) => ({
    country_code: config.code,
    municipality: municipality.municipality,
    district: municipality.district,
    province: municipality.province,
    municipality_slug: municipality.slug.municipality,
    district_slug: municipality.slug.district,
    province_slug: municipality.slug.province,
    composite_key: municipality.compositeKey,
  }));

  const { data: municipalityRows, error: municipalityError } = await supabase
    .schema("analytics")
    .from("municipalities")
    .upsert(municipalitiesPayload, {
      onConflict: "country_code,composite_key",
    })
    .select("id, composite_key");

  if (municipalityError) {
    throw municipalityError;
  }

  const municipalityIdByKey = new Map(
    municipalityRows.map((row) => [row.composite_key, row.id]),
  );

  const indicatorValuePayload = analyticsData.municipalities.flatMap((municipality) =>
    Object.entries(municipality.indicators).map(([indicatorId, numericValue]) => ({
      release_id: releaseIdByYear.get(municipality.year),
      municipality_id: municipalityIdByKey.get(municipality.compositeKey),
      indicator_id: indicatorId,
      year: municipality.year,
      numeric_value: numericValue,
    })),
  );

  await upsertRows("municipality_indicator_values", indicatorValuePayload, {
    onConflict: "release_id,municipality_id,indicator_id",
  });

  const scoreValuePayload = analyticsData.municipalities.flatMap((municipality) =>
    analyticsData.scoreDefinitions.map((definition) => ({
      release_id: releaseIdByYear.get(municipality.year),
      municipality_id: municipalityIdByKey.get(municipality.compositeKey),
      score_id: definition.id,
      year: municipality.year,
      score_value: municipality.scores[definition.id],
    })),
  );

  await upsertRows("municipality_score_values", scoreValuePayload, {
    onConflict: "release_id,municipality_id,score_id",
  });

  const scoreComponentValuePayload = analyticsData.municipalities.flatMap((municipality) =>
    Object.entries(municipality.scoreComponents).map(([componentId, scoreValue]) => ({
      release_id: releaseIdByYear.get(municipality.year),
      municipality_id: municipalityIdByKey.get(municipality.compositeKey),
      component_id: componentId,
      year: municipality.year,
      score_value: scoreValue,
    })),
  );

  try {
    await upsertRows("municipality_score_component_values", scoreComponentValuePayload, {
      onConflict: "release_id,municipality_id,component_id",
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing analytics.municipality_score_component_values. Apply supabase/migrations/0003_component_and_context_tables.sql and rerun npm run ingest:supabase.",
      );
    }
    throw error;
  }

  const contextValuePayload = analyticsData.municipalities.map((municipality) => ({
    release_id: releaseIdByYear.get(municipality.year),
    municipality_id: municipalityIdByKey.get(municipality.compositeKey),
    year: municipality.year,
    population:
      municipality.context.population === null
        ? null
        : Math.round(municipality.context.population),
    total_land_area_km2: municipality.context.totalLandAreaKm2,
    total_road_length_km: municipality.context.totalRoadLengthKm,
    total_railway_length_km: municipality.context.totalRailwayLengthKm,
    road_flood_risk_km: municipality.context.roadFloodRiskKm,
    road_heatwave_risk_km: municipality.context.roadHeatwaveRiskKm,
    railway_flood_risk_km: municipality.context.railwayFloodRiskKm,
    railway_heatwave_risk_km: municipality.context.railwayHeatwaveRiskKm,
  }));

  try {
    await upsertRows("municipality_context_values", contextValuePayload, {
      onConflict: "release_id,municipality_id",
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing analytics.municipality_context_values. Apply supabase/migrations/0003_component_and_context_tables.sql and rerun npm run ingest:supabase.",
      );
    }
    throw error;
  }

  console.log(
    `Ingested ${config.name} analytics releases ${analyticsData.years.join(", ")} with ${municipalities.length} admin units.`,
  );
}
