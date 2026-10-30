#!/usr/bin/env node
// Builds the plan store from the Phase 0 inventory: one record per plan URL, with the units
// it covers, its language and script, and a status; and the page-indexed text of each plan
// with a text layer, each page flagged ok, empty, or garbled.
//
// Local files for now (Phase 3a); they move to Supabase tables in 3b once the shape is settled.
// Usage: node scripts/build-plan-store.mjs [--inventory data/ai-audit/plan-inventory-<date>.csv]
// Writes data/plan-store/documents.json and data/plan-store/pages/<id>.json (outside git).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { documentReadable, parsePlanText, toPlanPages } from "../src/lib/plans/pages.ts";

const OUT_DIR = "data/plan-store";

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

function inventoryPath() {
  const flag = process.argv.indexOf("--inventory");
  if (flag !== -1) return process.argv[flag + 1];
  const files = readdirSync("data/ai-audit").filter((file) => /^plan-inventory-\d{8}\.csv$/.test(file)).sort();
  if (files.length === 0) throw new Error("No plan inventory in data/ai-audit; run scripts/inventory-plan-documents.mjs first.");
  return path.join("data/ai-audit", files.at(-1));
}

const script = (row) => {
  const cyrillic = Number(row.cyrillic_share || 0);
  const latin = Number(row.latin_share || 0);
  const devanagari = Number(row.devanagari_share || 0);
  if (!cyrillic && !latin && !devanagari) return null;
  return cyrillic >= latin && cyrillic >= devanagari ? "Cyrillic" : devanagari > latin ? "Devanagari" : "Latin";
};

const inventory = inventoryPath();
const rows = parseCsv(readFileSync(inventory, "utf8")).filter((row) => row.url);
const byUrl = new Map();
for (const row of rows) byUrl.set(row.url, [...(byUrl.get(row.url) ?? []), row]);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(path.join(OUT_DIR, "pages"), { recursive: true });

const documents = [];
for (const [url, sharing] of byUrl) {
  const first = sharing[0];
  const id = `${first.country.toLowerCase()}-${createHash("sha1").update(url).digest("hex").slice(0, 10)}`;
  const textFile = sharing.map((row) => row.text_file).find((file) => file && existsSync(file)) ?? null;
  const pages = textFile ? toPlanPages(parsePlanText(readFileSync(textFile, "utf8")).pages) : [];
  const quality = { ok: 0, empty: 0, garbled: 0 };
  for (const page of pages) quality[page.quality] += 1;

  // Text: a text layer on at least 80 percent of pages. Scanned and mixed plans wait for OCR.
  const status = textFile && documentReadable(pages)
    ? "text"
    : ["scanned", "mixed"].includes(first.bucket) || textFile
      ? "needs OCR"
      : first.bucket === "non_pdf"
        ? "not a PDF"
        : "failed";

  if (pages.length > 0) writeFileSync(path.join(OUT_DIR, "pages", `${id}.json`), JSON.stringify({ id, url, pages }));
  documents.push({
    id,
    url,
    country: first.country,
    level: first.plan_level === "national" ? "national" : "local",
    title: first.title,
    units: [...new Set(sharing.filter((row) => row.plan_level !== "national").map((row) => row.unit))].sort(),
    status,
    language: first.language_guess || null,
    script: script(first),
    pages: pages.length || Number(first.pages) || null,
    pageQuality: quality,
    error: status === "failed" ? first.error_message || first.error_class || null : null,
  });
}

documents.sort((a, b) => a.country.localeCompare(b.country) || a.level.localeCompare(b.level) || a.id.localeCompare(b.id));
writeFileSync(path.join(OUT_DIR, "documents.json"), `${JSON.stringify({ inventory: path.basename(inventory), documents }, null, 2)}\n`);

for (const country of [...new Set(documents.map((document) => document.country))]) {
  const mine = documents.filter((document) => document.country === country);
  const counts = {};
  for (const document of mine) counts[document.status] = (counts[document.status] ?? 0) + 1;
  const pageCounts = mine.reduce((sum, document) => ({ ok: sum.ok + document.pageQuality.ok, empty: sum.empty + document.pageQuality.empty, garbled: sum.garbled + document.pageQuality.garbled }), { ok: 0, empty: 0, garbled: 0 });
  console.log(`${country}: ${mine.length} documents ${JSON.stringify(counts)}; pages ${JSON.stringify(pageCounts)}`);
}
console.log(`Wrote ${documents.length} documents to ${OUT_DIR}`);
