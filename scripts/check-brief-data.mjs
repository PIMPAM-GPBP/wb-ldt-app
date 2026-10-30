#!/usr/bin/env node
// Checks that the generated analytics files, which the brief's fact sheets are built from,
// hold the same values as Supabase, which the map reads: every score, component, indicator,
// and context value for every unit with a boundary and every year of each country's releases.
//
// Read-only. Usage: node scripts/check-brief-data.mjs [NPL|SRB|ZMB ...]
// Exits 1 when any value differs; rerun `npm run build:data` after a data release, then this.
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { countries } from "../src/lib/countries.ts";
import { loadLocalEnv } from "./lib/load-env.mjs";

const PAGE_SIZE = 1000;
const TOLERANCE = 1e-6;
const CONTEXT_COLUMNS = {
  population: "population",
  totalLandAreaKm2: "total_land_area_km2",
  totalRoadLengthKm: "total_road_length_km",
  totalRailwayLengthKm: "total_railway_length_km",
  roadFloodRiskKm: "road_flood_risk_km",
  roadHeatwaveRiskKm: "road_heatwave_risk_km",
  railwayFloodRiskKm: "railway_flood_risk_km",
  railwayHeatwaveRiskKm: "railway_heatwave_risk_km",
};

await loadLocalEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).schema("analytics");

// Every paged read orders by a unique key; unordered pages skip and repeat rows.
async function selectAll(table, columns, filters, order) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns);
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Supabase may hold land area in m²; the app converts values over 100,000 to km² and rounds
// them to 2 decimals (normalizeLandAreaKm2 in queries.ts), so land area gets that much slack.
const normaliseLandArea = (value) => (typeof value === "number" && value > 100_000 ? value / 1_000_000 : value);

const same = (a, b, tolerance = TOLERANCE) =>
  (a == null && b == null) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance);

const requested = process.argv.slice(2).map((code) => code.toUpperCase());
const targets = countries.filter((country) => ["NPL", "ZMB", "SRB"].includes(country.code) && (requested.length === 0 || requested.includes(country.code)));
let total = 0;

for (const country of targets) {
  const dataset = JSON.parse(await readFile(country.fallbackDataPath, "utf8"));
  const generated = new Map(dataset.municipalities.map((record) => [`${record.compositeKey}|${record.year}`, record]));
  const units = await selectAll("municipalities", "id, composite_key", { country_code: country.code }, ["id"]);
  const keyOf = new Map(units.map((unit) => [unit.id, unit.composite_key]));
  const releases = (await selectAll("dataset_releases", "id, release_key, year", { country_code: country.code }, ["year", "id"])).filter((release) =>
    dataset.years.includes(release.year),
  );

  const counts = { scores: 0, components: 0, indicators: 0, context: 0, missingInSupabase: 0 };
  const examples = [];
  const note = (kind, text) => {
    counts[kind] += 1;
    if (examples.length < 8) examples.push(text);
  };

  for (const release of releases) {
    const filters = { release_id: release.id, year: release.year };
    const [scores, components, indicators, context] = await Promise.all([
      selectAll("municipality_score_values", "municipality_id, score_id, score_value", filters, ["municipality_id", "score_id"]),
      selectAll("municipality_score_component_values", "municipality_id, component_id, score_value", filters, ["municipality_id", "component_id"]),
      selectAll("municipality_indicator_values", "municipality_id, indicator_id, numeric_value", filters, ["municipality_id", "indicator_id"]),
      selectAll("municipality_context_values", `municipality_id, ${Object.values(CONTEXT_COLUMNS).join(", ")}`, filters, ["municipality_id"]),
    ]);

    const seen = new Set();
    const compare = (kind, rows, field, valueOf, read, tolerance = TOLERANCE) => {
      for (const row of rows) {
        const record = generated.get(`${keyOf.get(row.municipality_id)}|${release.year}`);
        if (!record) continue; // A unit without a boundary; the brief leaves it out.
        seen.add(record.compositeKey);
        const supabaseValue = valueOf(row);
        const fileValue = read(record, row);
        if (!same(supabaseValue, fileValue, tolerance)) note(kind, `${kind} ${record.compositeKey} ${release.year} ${row[field] ?? ""}: Supabase ${supabaseValue}, file ${fileValue}`);
      }
    };
    compare("scores", scores, "score_id", (row) => row.score_value, (record, row) => record.scores[row.score_id]);
    compare("components", components, "component_id", (row) => row.score_value, (record, row) => record.scoreComponents[row.component_id]);
    compare("indicators", indicators, "indicator_id", (row) => row.numeric_value, (record, row) => record.indicators[row.indicator_id]);
    for (const [field, column] of Object.entries(CONTEXT_COLUMNS)) {
      compare(
        "context",
        context,
        null,
        (row) => (field === "totalLandAreaKm2" ? normaliseLandArea(row[column]) : row[column]),
        (record) => record.context[field],
        // Supabase rounds population to whole people; the file keeps the raw estimate.
        field === "totalLandAreaKm2" ? 0.005 : field === "population" ? 0.5 : TOLERANCE,
      );
    }
    for (const record of dataset.municipalities.filter((entry) => entry.year === release.year)) {
      if (!seen.has(record.compositeKey)) note("missingInSupabase", `${record.compositeKey} ${release.year} has no Supabase values`);
    }
  }

  const differences = Object.values(counts).reduce((sum, count) => sum + count, 0);
  total += differences;
  console.log(`${country.code}: ${releases.length} releases, ${dataset.municipalities.length} unit-years in the file; differences ${JSON.stringify(counts)}`);
  for (const example of examples) console.log(`  ${example}`);
}

if (total > 0) {
  console.log(`\n${total} differences. Rebuild the generated files with npm run build:data, or fix the source, before trusting the brief.`);
  process.exit(1);
}
console.log("\nThe generated files match Supabase for every unit with a boundary.");
