#!/usr/bin/env node
// Picks the planning brief's golden set and writes its fact sheets as test fixtures.
//
// The golden set is the units every prompt, schema, or model change is checked on first:
// score extremes, the largest changes, the most unrecorded data, units with and without a
// readable local plan, the units with Phase 0 runs, and one typical unit per higher unit
// until the country has its share. Selection is deterministic; each unit records why it is in.
//
// Usage: node scripts/build-brief-golden-set.mjs [--inventory data/ai-audit/plan-inventory-<date>.csv]
// Without the plan inventory (it is outside git), every unit's plan status is "unknown".
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildFactSheets, FACT_SHEET_VERSION } from "../src/lib/brief/facts.ts";
import { countries } from "../src/lib/countries.ts";

const FIXTURE_DIR = "tests/fixtures/brief";
// The review console orders its queue by the golden set, so the list lives with the app code.
const GOLDEN_SET_PATH = "src/lib/brief/golden-set.json";
const PER_COUNTRY = 15;
// Units with stored runs from Phase 0, kept so old and new output can be compared.
const SEEDS = {
  NPL: "bagmati-bhaktapur-bhaktapur",
  ZMB: "central-central-chibombo",
  SRB: "beograd-beograd-beograd-barajevo",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  header[0] = header[0].replace(/^﻿/, "");
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

const normalizeName = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function latestInventory() {
  const flag = process.argv.indexOf("--inventory");
  if (flag !== -1) return process.argv[flag + 1];
  const dir = "data/ai-audit";
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((file) => /^plan-inventory-\d{8}\.csv$/.test(file)).sort();
  return files.length > 0 ? path.join(dir, files.at(-1)) : null;
}

/** Best plan status per country and unit name: text beats scanned beats failed. */
function planStatuses(inventoryPath) {
  const statuses = new Map();
  if (!inventoryPath) return statuses;
  const order = ["text", "mixed", "scanned", "non_pdf", "failed"];
  for (const row of parseCsv(readFileSync(inventoryPath, "utf8"))) {
    if (row.plan_level === "national") continue;
    const key = `${row.country}|${normalizeName(row.unit)}`;
    const current = statuses.get(key);
    if (!current || order.indexOf(row.bucket) < order.indexOf(current)) statuses.set(key, row.bucket);
  }
  return statuses;
}

function selectUnits(code, sheets, planStatusOf) {
  const picked = new Map();
  const pick = (sheet, reason) => {
    if (!sheet) return;
    const entry = picked.get(sheet.unit.key) ?? { sheet, reasons: [] };
    entry.reasons.push(reason);
    picked.set(sheet.unit.key, entry);
  };
  const value = (sheet, id) => sheet.facts[id]?.value ?? null;
  const byValue = (id, direction) =>
    [...sheets]
      .filter((sheet) => typeof value(sheet, id) === "number")
      .sort((a, b) => direction * (value(a, id) - value(b, id)) || a.unit.key.localeCompare(b.unit.key));

  pick(sheets.find((sheet) => sheet.unit.key === SEEDS[code]), "has stored runs from Phase 0");

  for (const pillar of sheets[0].pillars) {
    pick(byValue(`${pillar.key}.score`, -1)[0], `highest ${pillar.label}`);
    pick(byValue(`${pillar.key}.score`, 1)[0], `lowest ${pillar.label}`);
  }

  for (const pillar of sheets[0].pillars) {
    const withDirection = (direction) => sheets.filter((sheet) => value(sheet, `${pillar.key}.change.direction`) === direction);
    const rises = withDirection("rose").sort((a, b) => value(b, `${pillar.key}.change.points`) - value(a, `${pillar.key}.change.points`));
    const falls = withDirection("fell").sort((a, b) => value(a, `${pillar.key}.change.points`) - value(b, `${pillar.key}.change.points`));
    pick(rises[0], `largest rise in the ${pillar.label}`);
    pick(falls[0], `largest fall in the ${pillar.label}`);
  }

  const unrecorded = (sheet) => sheet.pillars.reduce((sum, pillar) => sum + value(sheet, `${pillar.key}.coverage.not_recorded`), 0);
  pick([...sheets].sort((a, b) => unrecorded(b) - unrecorded(a) || a.unit.key.localeCompare(b.unit.key))[0], "most components with nothing recorded");
  pick([...sheets].sort((a, b) => unrecorded(a) - unrecorded(b) || a.unit.key.localeCompare(b.unit.key))[0], "fewest components with nothing recorded");

  const median = byValue("prosperity.score", 1)[Math.floor(sheets.length / 2)];
  pick(median, "median Prosperity Score");

  // Units with and without a readable local plan, three of each where the country has them.
  for (const [wanted, reason] of [[true, "has a local plan with a text layer"], [false, "has no readable local plan"]]) {
    const has = (sheet) => (planStatusOf(sheet) === "text") === wanted;
    const missing = 3 - [...picked.values()].filter((entry) => has(entry.sheet)).length;
    if (missing <= 0) continue;
    const pool = byValue("prosperity.score", 1).filter((sheet) => has(sheet) && !picked.has(sheet.unit.key));
    for (let index = 0; index < missing && pool.length > 0; index += 1) {
      pick(pool[Math.floor(((index + 0.5) * pool.length) / missing)], reason);
    }
  }

  // Then one typical unit per higher unit not yet covered, until the country has its share.
  const covered = new Set([...picked.values()].map((entry) => entry.sheet.unit.province));
  const provinces = [...new Set(sheets.map((sheet) => sheet.unit.province))].sort();
  for (const province of provinces) {
    if (picked.size >= PER_COUNTRY) break;
    if (covered.has(province)) continue;
    const members = byValue("prosperity.score", 1).filter((sheet) => sheet.unit.province === province);
    pick(members[Math.floor(members.length / 2)], `typical unit in ${province}`);
  }

  return [...picked.values()];
}

function stringifySheet(sheet) {
  const { facts, ...rest } = sheet;
  const head = JSON.stringify({ ...rest, facts: "__FACTS__" }, null, 2);
  const lines = Object.entries(facts).map(([id, fact]) => `    ${JSON.stringify(id)}: ${JSON.stringify(fact)}`);
  return `${head.replace('"__FACTS__"', `{\n${lines.join(",\n")}\n  }`)}\n`;
}

const inventoryPath = latestInventory();
const statuses = planStatuses(inventoryPath);
const sheetDir = path.join(FIXTURE_DIR, "fact-sheets");
rmSync(sheetDir, { recursive: true, force: true });

const units = [];
for (const country of countries.filter((entry) => SEEDS[entry.code])) {
  const dataset = JSON.parse(readFileSync(country.fallbackDataPath, "utf8"));
  const sheets = buildFactSheets(dataset, country);
  const planStatusOf = (sheet) =>
    inventoryPath ? (statuses.get(`${country.code}|${normalizeName(sheet.unit.name)}`) ?? "none") : "unknown";
  const selected = selectUnits(country.code, sheets, planStatusOf);

  mkdirSync(path.join(sheetDir, country.code.toLowerCase()), { recursive: true });
  for (const { sheet, reasons } of selected) {
    writeFileSync(path.join(sheetDir, country.code.toLowerCase(), `${sheet.unit.key}.json`), stringifySheet(sheet));
    units.push({
      country: country.code,
      unitKey: sheet.unit.key,
      name: sheet.unit.name,
      province: sheet.unit.province,
      planStatus: planStatusOf(sheet),
      reasons,
    });
  }
  console.log(`${country.code}: ${selected.length} units from ${sheets.length}`);
}

writeFileSync(
  GOLDEN_SET_PATH,
  `${JSON.stringify({ factSheetVersion: FACT_SHEET_VERSION, planInventory: inventoryPath ? path.basename(inventoryPath) : null, units }, null, 2)}\n`,
);
console.log(`${units.length} units: the list in ${GOLDEN_SET_PATH}, fact sheets in ${FIXTURE_DIR}`);
