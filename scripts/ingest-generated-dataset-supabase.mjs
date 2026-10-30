// Loads a country delivered as a generated analytics dataset (the AnalyticsDataset JSON shape,
// optionally split into `<name>-<year>.json` files) into the analytics tables. Countries built
// from raw CSVs in data/ use ingest-supabase.mjs instead.
//
//   node scripts/ingest-generated-dataset-supabase.mjs --country VNM \
//     --dataset path/to/analytics-data.json --geojson public/data/vietnam/municipalities.geojson
//
// Indicator, score and component definitions are shared across countries, so this script only
// checks that the dataset's ids exist and never rewrites them. A country whose components feed
// different pillar scores gets its own grouping in analytics.country_score_components.
import fs from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnv } from "./lib/load-env.mjs";

await loadLocalEnv();

const CHUNK_SIZE = 1000;
const CONCURRENCY = 8;

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function requireArg(name) {
  const value = getArgValue(name, null);
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function chunkRows(rows, size = CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function runWithConcurrency(items, limit, task) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readDataset(filePath) {
  const dataset = await readJson(filePath);
  if (dataset.municipalities) {
    return dataset;
  }

  const yearFiles = await Promise.all(
    dataset.years.map((year) => readJson(filePath.replace(/\.json$/, `-${year}.json`))),
  );
  return {
    ...dataset,
    municipalities: yearFiles.flatMap((yearFile) => yearFile.municipalities),
  };
}

async function selectIds(table) {
  const { data, error } = await analytics.from(table).select("id");
  if (error) {
    throw error;
  }
  return new Set(data.map((row) => row.id));
}

async function upsertRows(table, rows, onConflict) {
  await runWithConcurrency(chunkRows(rows), CONCURRENCY, async (chunk) => {
    const { error } = await analytics.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw error;
    }
  });
  console.log(`  ${table}: ${rows.length} rows`);
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
const analytics = supabase.schema("analytics");

const countryCode = requireArg("--country").toUpperCase();
const datasetPath = requireArg("--dataset");
const geojsonPath = getArgValue("--geojson", null);

const { data: countryRow, error: countryError } = await analytics
  .from("countries")
  .select("country_name")
  .eq("country_code", countryCode)
  .maybeSingle();

if (countryError) {
  throw countryError;
}

if (!countryRow) {
  throw new Error(`${countryCode} is not in analytics.countries. Add it in a migration first.`);
}

const dataset = await readDataset(datasetPath);
const [indicatorIds, scoreIds, componentIds] = await Promise.all([
  selectIds("indicators"),
  selectIds("score_definitions"),
  selectIds("score_components"),
]);
const unknownIds = [
  ...dataset.indicatorDefinitions.map((indicator) => indicator.id).filter((id) => !indicatorIds.has(id)),
  ...dataset.scoreDefinitions.map((definition) => definition.id).filter((id) => !scoreIds.has(id)),
  ...dataset.scoreDefinitions
    .flatMap((definition) => definition.componentIds)
    .filter((id) => !componentIds.has(id)),
];

if (unknownIds.length > 0) {
  throw new Error(
    `The dataset uses ids that are not in the shared definition tables: ${unknownIds.join(", ")}`,
  );
}

console.log(
  `Ingesting ${countryRow.country_name}: ${dataset.municipalities.length} rows across ${dataset.years.join(", ")}`,
);

const latestYear = Math.max(...dataset.years);
const { data: releaseRows, error: releaseError } = await analytics
  .from("dataset_releases")
  .upsert(
    dataset.years.map((year) => ({
      country_code: countryCode,
      release_key: `${countryCode.toLowerCase()}-${year}-v1`,
      year,
      label: `${countryRow.country_name} LDT ${year}`,
      admin_file_name: dataset.release.adminFileName,
      score_file_name: dataset.release.scoreFileName,
      geojson_file_name: dataset.release.geojsonFileName,
      is_active: year === latestYear,
    })),
    { onConflict: "country_code,release_key" },
  )
  .select("id, year");

if (releaseError) {
  throw releaseError;
}

const releaseIdByYear = new Map(releaseRows.map((row) => [row.year, row.id]));

const municipalitiesByKey = new Map(
  dataset.municipalities.map((municipality) => [municipality.compositeKey, municipality]),
);
const municipalityIdByKey = new Map();

await runWithConcurrency(chunkRows([...municipalitiesByKey.values()]), CONCURRENCY, async (chunk) => {
  const { data, error } = await analytics
    .from("municipalities")
    .upsert(
      chunk.map((municipality) => ({
        country_code: countryCode,
        municipality: municipality.municipality,
        district: municipality.district,
        province: municipality.province,
        municipality_slug: municipality.slug.municipality,
        district_slug: municipality.slug.district,
        province_slug: municipality.slug.province,
        composite_key: municipality.compositeKey,
      })),
      { onConflict: "country_code,composite_key" },
    )
    .select("id, composite_key");

  if (error) {
    throw error;
  }

  for (const row of data) {
    municipalityIdByKey.set(row.composite_key, row.id);
  }
});
console.log(`  municipalities: ${municipalityIdByKey.size} rows`);

function valueKeys(municipality) {
  return {
    release_id: releaseIdByYear.get(municipality.year),
    municipality_id: municipalityIdByKey.get(municipality.compositeKey),
    year: municipality.year,
  };
}

await upsertRows(
  "municipality_score_values",
  dataset.municipalities.flatMap((municipality) =>
    dataset.scoreDefinitions.map((definition) => ({
      ...valueKeys(municipality),
      score_id: definition.id,
      score_value: municipality.scores[definition.id] ?? null,
    })),
  ),
  "release_id,municipality_id,score_id",
);

await upsertRows(
  "municipality_score_component_values",
  dataset.municipalities.flatMap((municipality) =>
    Object.entries(municipality.scoreComponents).map(([componentId, scoreValue]) => ({
      ...valueKeys(municipality),
      component_id: componentId,
      score_value: scoreValue,
    })),
  ),
  "release_id,municipality_id,component_id",
);

await upsertRows(
  "municipality_context_values",
  dataset.municipalities.map((municipality) => ({
    ...valueKeys(municipality),
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
  })),
  "release_id,municipality_id",
);

await upsertRows(
  "municipality_indicator_values",
  dataset.municipalities.flatMap((municipality) =>
    Object.entries(municipality.indicators).map(([indicatorId, numericValue]) => ({
      ...valueKeys(municipality),
      indicator_id: indicatorId,
      numeric_value: numericValue,
    })),
  ),
  "release_id,municipality_id,indicator_id",
);

const { error: deleteGroupingError } = await analytics
  .from("country_score_components")
  .delete()
  .eq("country_code", countryCode);

if (deleteGroupingError) {
  throw deleteGroupingError;
}

await upsertRows(
  "country_score_components",
  dataset.scoreDefinitions.flatMap((definition) =>
    definition.componentIds.map((componentId, index) => ({
      country_code: countryCode,
      component_id: componentId,
      parent_score_id: definition.id,
      display_order: index + 1,
    })),
  ),
  "country_code,component_id",
);

if (geojsonPath) {
  const geojson = await readJson(geojsonPath);
  const features = geojson.features.filter((feature) =>
    municipalityIdByKey.has(feature.properties.compositeKey),
  );

  await runWithConcurrency(features, CONCURRENCY, async (feature) => {
    const { error } = await analytics.rpc("upsert_municipality_boundary", {
      p_municipality_id: municipalityIdByKey.get(feature.properties.compositeKey),
      p_source_feature_key: feature.properties.compositeKey,
      p_geojson: JSON.stringify(feature.geometry),
      p_raw_properties: feature.properties,
    });

    if (error) {
      throw error;
    }
  });
  console.log(
    `  municipality_boundaries: ${features.length} of ${geojson.features.length} features matched`,
  );
}

console.log(`Ingested ${countryRow.country_name}.`);
