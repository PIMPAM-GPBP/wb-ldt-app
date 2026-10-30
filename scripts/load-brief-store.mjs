#!/usr/bin/env node
// Loads the plan store and extracted commitments into the brief tables.
//
//   --plans                 upserts data/plan-store/documents.json and every page file
//   --commitments <jsonl>   adds one extraction run, live or batch, and its kept commitments;
//                           a run whose source is already loaded is refused
//
// Writes only to BRIEF_SUPABASE_URL with BRIEF_SUPABASE_SERVICE_ROLE_KEY: the branch during
// Phase 3b. It never falls back to the main project; production waits for Son's approval.
// Usage: node scripts/load-brief-store.mjs --plans --commitments data/plan-store/commitments-20261030-v4.jsonl
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnv } from "./lib/load-env.mjs";

const ROWS_PER_REQUEST = 400;

await loadLocalEnv();
const url = process.env.BRIEF_SUPABASE_URL;
const key = process.env.BRIEF_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set BRIEF_SUPABASE_URL and BRIEF_SUPABASE_SERVICE_ROLE_KEY; this script never writes to the main project.");
const store = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const commitmentFiles = args.flatMap((arg, index) => (args[index - 1] === "--commitments" ? [arg] : []));

async function insertAll(table, rows, options = {}) {
  for (let index = 0; index < rows.length; index += ROWS_PER_REQUEST) {
    const slice = rows.slice(index, index + ROWS_PER_REQUEST);
    const { error } = options.upsert ? await store.from(table).upsert(slice, options) : await store.from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

if (args.includes("--plans")) {
  const { documents } = JSON.parse(readFileSync("data/plan-store/documents.json", "utf8"));
  await insertAll(
    "brief_plan_documents",
    documents.map((document) => ({
      id: document.id,
      url: document.url,
      country_code: document.country,
      level: document.level,
      title: document.title,
      units: document.units,
      status: document.status,
      language: document.language,
      script: document.script,
      pages: document.pages,
      page_quality: document.pageQuality,
      error: document.error,
      updated_at: new Date().toISOString(),
    })),
    { upsert: true, onConflict: "id" },
  );
  let pages = 0;
  for (const document of documents.filter((entry) => entry.status === "text")) {
    const file = JSON.parse(readFileSync(`data/plan-store/pages/${document.id}.json`, "utf8"));
    const rows = file.pages.map((page) => ({ document_id: document.id, page_num: page.num, text: page.text.replaceAll("\u0000", ""), quality: page.quality }));
    await insertAll("brief_plan_pages", rows, { upsert: true, onConflict: "document_id,page_num" });
    pages += rows.length;
  }
  console.log(`Plans: ${documents.length} documents, ${pages} pages.`);
}

for (const file of commitmentFiles) {
  const records = readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const source = records[0]?.batchId ?? path.basename(file, ".jsonl");
  const { data: existing } = await store.from("brief_extraction_runs").select("id").eq("source", source).maybeSingle();
  if (existing) {
    console.log(`${source}: already loaded, skipped.`);
    continue;
  }
  const { data: run, error } = await store
    .from("brief_extraction_runs")
    .insert({
      source,
      model: records[0].model,
      prompt_version: records[0].promptVersion,
      openai_batch_id: records[0].batchId ?? null,
      status: "loaded",
      documents: records.length,
      chunks: records.reduce((sum, record) => sum + record.chunks, 0),
      cost_usd: records.reduce((sum, record) => sum + record.costUsd, 0),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`brief_extraction_runs: ${error.message}`);

  const rows = records.flatMap((record) =>
    record.kept.map((commitment) => ({
      run_id: run.id,
      document_id: record.id,
      quote: commitment.quote,
      page: commitment.page,
      cited_page: commitment.citedPage,
      english: commitment.english,
      components: commitment.components,
      kind: commitment.kind,
      strength: commitment.strength,
      match: commitment.match,
      similarity: Number(commitment.similarity.toFixed(3)),
    })),
  );
  await insertAll("brief_commitments", rows);
  console.log(`${source}: ${records.length} plans, ${rows.length} commitments.`);
}
