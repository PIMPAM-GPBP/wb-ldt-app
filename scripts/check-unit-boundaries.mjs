#!/usr/bin/env node
// Lists units that have scores but no boundary: in Supabase (no municipality_boundaries row) and in the
// app's boundary file (no feature with the unit's composite key). The analytics pages leave these units
// out of every rank, count, and average, so any unit listed here needs a look in the source data.
//
// Read-only. Usage: node scripts/check-unit-boundaries.mjs [NPL|SRB|ZMB ...]
// Exits 1 when any country has a unit without a boundary.
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnv } from "./lib/load-env.mjs";

const BOUNDARY_FILES = {
  NPL: "public/data/nepal-municipalities.geojson",
  SRB: "public/data/serbia/municipalities.geojson",
  ZMB: "public/data/zambia/municipalities.geojson",
};
const PAGE_SIZE = 1000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const normalizeName = (name) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function loadUnits(supabase, countryCode) {
  const units = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("municipalities")
      .select("id, municipality, district, province, composite_key, municipality_boundaries(municipality_id)")
      .eq("country_code", countryCode)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    units.push(...data);
    if (data.length < PAGE_SIZE) return units;
  }
}

async function loadBoundaryKeys(countryCode) {
  const collection = JSON.parse(await readFile(BOUNDARY_FILES[countryCode], "utf8"));
  return new Set(collection.features.map((feature) => feature.properties.compositeKey));
}

await loadLocalEnv();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const requested = process.argv.slice(2).map((code) => code.toUpperCase());
const countries = requested.length > 0 ? requested : Object.keys(BOUNDARY_FILES);
let problems = 0;

for (const countryCode of countries) {
  if (!BOUNDARY_FILES[countryCode]) throw new Error(`Unknown country code: ${countryCode}`);
  const [units, fileKeys] = await Promise.all([loadUnits(supabase, countryCode), loadBoundaryKeys(countryCode)]);

  const withoutDbBoundary = units.filter((unit) => (unit.municipality_boundaries ?? []).length === 0);
  const withoutFileBoundary = units.filter((unit) => !fileKeys.has(unit.composite_key));
  const flagged = new Map([...withoutDbBoundary, ...withoutFileBoundary].map((unit) => [unit.id, unit]));

  // A unit without a boundary that shares its name with one that has one is the sliver pattern
  // seen in Nepal: a piece of a real unit filed under a neighbouring district.
  const mappedByName = new Map();
  for (const unit of units) {
    if (flagged.has(unit.id)) continue;
    const key = normalizeName(unit.municipality);
    mappedByName.set(key, [...(mappedByName.get(key) ?? []), unit]);
  }

  console.log(
    `${countryCode}: ${units.length} units, ${withoutDbBoundary.length} without a boundary row in Supabase, ` +
      `${withoutFileBoundary.length} missing from ${BOUNDARY_FILES[countryCode]} (${fileKeys.size} features)`,
  );
  for (const unit of [...flagged.values()].sort((a, b) => a.composite_key.localeCompare(b.composite_key))) {
    const namesakes = (mappedByName.get(normalizeName(unit.municipality)) ?? [])
      .map((other) => `${other.municipality}, ${other.district}`)
      .join("; ");
    const where = [
      withoutDbBoundary.includes(unit) ? "no Supabase boundary" : null,
      withoutFileBoundary.includes(unit) ? "not in boundary file" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${unit.composite_key} (${where})${namesakes ? `; same name with a boundary: ${namesakes}` : ""}`);
  }
  problems += flagged.size;
}

if (problems > 0) {
  console.log(`\n${problems} units without a boundary. The analytics pages leave them out until the source data is fixed.`);
  process.exit(1);
}
console.log("\nEvery unit has a boundary.");
