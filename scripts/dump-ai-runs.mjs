#!/usr/bin/env node
// Phase 0 read script over the AI run store. Dumps the last N completed stage runs and every stored
// document context, and writes a labelling sheet for the hand review of failure modes.
//
// Read-only against Supabase (SELECT only). Makes no model or web calls.
// Usage: node scripts/dump-ai-runs.mjs [--limit 100] [--date yyyymmdd]
//
// Outputs, under data/ai-audit/ (gitignored):
//   runs-<date>.jsonl               one line per run, with the full output text
//   labels-<date>.csv               one row per run with empty label columns for the team
//   document-contexts-<date>.csv    one row per stored document context with its extraction metadata
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { buildCitationNotes, splitCitations } from "../src/components/analytics/ai-citations.ts";
import { loadLocalEnv } from "./lib/load-env.mjs";

const OUTPUT_DIR = "data/ai-audit";
const PREVIEW_LENGTH = 240;
// A stored document counts as having text when it has at least this many non-whitespace characters.
const MIN_TEXT_CHARS = 200;

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}${month}${day}`;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function collapse(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// UTF-8 with a BOM so Excel reads Cyrillic and Devanagari correctly.
function toCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `﻿${lines.join("\n")}\n`;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const [key, count] of counts) console.log(`  ${key}: ${count}`);
}

// Letters by script, as shares of all letters in the text.
function scriptMix(text) {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const share = (pattern) => (letters === 0 ? 0 : Number(((text.match(pattern)?.length ?? 0) / letters).toFixed(3)));
  return {
    letters,
    devanagari_share: share(/\p{Script=Devanagari}/gu),
    cyrillic_share: share(/\p{Script=Cyrillic}/gu),
    latin_share: share(/\p{Script=Latin}/gu),
  };
}

// Numbers as a reader would see them: 80, 33.94, 1,200, 12%, 2016. Excludes passage ids and note numbers in brackets.
function countNumbers(text) {
  return (text ?? "").replace(/\[[^\]]*\]/g, " ").match(/(?<![\w.])\d[\d,]*(?:\.\d+)?%?(?![\w.])/g)?.length ?? 0;
}

function unitNameOf(run) {
  const output = run.structured_output ?? {};
  if (output.municipality && typeof output.municipality === "object" && output.municipality.name) {
    return String(output.municipality.name);
  }
  if (typeof output.province === "string" && output.province) return output.province;
  return run.province || run.municipality_id;
}

// Document stages store the whole extracted text in structured_output (about 1 MB per run). The JSONL
// keeps a length and hash instead so the file stays readable; the text itself is in the document contexts.
function trimStructuredOutput(output) {
  if (!output || typeof output !== "object") return output;
  const trimmed = { ...output };
  if (typeof trimmed.extractedText === "string") {
    trimmed.extractedTextLength = trimmed.extractedText.length;
    trimmed.extractedTextSha256 = sha256(trimmed.extractedText);
    delete trimmed.extractedText;
  }
  if (Array.isArray(trimmed.passages)) {
    trimmed.passageCount = trimmed.passages.length;
    delete trimmed.passages;
  }
  if (Array.isArray(trimmed.chunks)) {
    trimmed.chunkCount = trimmed.chunks.length;
    delete trimmed.chunks;
  }
  return trimmed;
}

// Uses the app's own citation resolver, so the count matches what the brief UI would show as unresolved.
function unresolvedCitations(run) {
  const notes = buildCitationNotes(run.stage_name, run.source_references);
  const unresolved = [];
  for (const segment of splitCitations(run.rendered_output ?? "", notes)) {
    if (segment.kind === "cite") unresolved.push(...segment.unresolved);
  }
  return unresolved;
}

function documentStatus(context) {
  const metadata = context.extraction_metadata ?? {};
  const textChars = (context.extracted_text ?? "").replace(/\s/g, "").length;
  if (metadata.fallbackReason) return "exa_fallback";
  if (textChars < MIN_TEXT_CHARS) return "empty_text";
  return "direct_text";
}

await loadLocalEnv();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
}).schema("analytics");

const limit = Number(getArgValue("--limit", "100"));
const stamp = getArgValue("--date", todayStamp());
await mkdir(OUTPUT_DIR, { recursive: true });

const { data: runs, error: runsError } = await supabase
  .from("ai_stage_runs")
  .select(
    "id, cache_key, stage_name, country_code, release_key, year, municipality_id, province, score_id, model_name, model_settings, prompt_version, invalidation_version, source_fingerprint, input_hash, prompt_hash, status, rendered_output, structured_output, source_references, error_message, token_usage, estimated_cost_usd, started_at, completed_at, created_at",
  )
  .eq("status", "completed")
  .order("created_at", { ascending: false })
  .limit(limit);
if (runsError) throw runsError;

const { data: contexts, error: contextsError } = await supabase
  .from("ai_document_contexts")
  .select(
    "id, country_code, source_type, title, province, source_url_or_path, content_mode, extracted_text, passages, chunks, extraction_metadata, content_fingerprint, extraction_version, created_at, updated_at",
  )
  .order("created_at", { ascending: false });
if (contextsError) throw contextsError;

// Runs JSONL. Full output text; structured_output trimmed as described above.
const runsPath = path.join(OUTPUT_DIR, `runs-${stamp}.jsonl`);
const seenOutputs = new Map();
const runRows = [];
for (const run of [...runs].reverse()) {
  // Oldest first so "same output as" points at the earlier run.
  const outputHash = sha256(run.rendered_output ?? "");
  const sameAs = seenOutputs.get(outputHash) ?? null;
  if (!sameAs) seenOutputs.set(outputHash, run.id);
  runRows.push({ run, outputHash, sameAs });
}
runRows.reverse();

const jsonl = runRows
  .map(({ run, outputHash }) =>
    JSON.stringify({
      ...run,
      output_sha256: outputHash,
      structured_output: trimStructuredOutput(run.structured_output),
      structured_output_trimmed: true,
    }),
  )
  .join("\n");
await writeFile(runsPath, `${jsonl}\n`);

// Labelling sheet. The team fills text_correct-style columns with 1 or 0; auto_ columns are machine hints.
const labelColumns = [
  "run_id",
  "created_at",
  "stage",
  "country",
  "unit",
  "unit_id",
  "theme",
  "model",
  "prompt_version",
  "output_chars",
  "output_preview",
  "auto_number_count",
  "auto_input_stored",
  "auto_unresolved_citations",
  "auto_unresolved_citation_labels",
  "auto_same_output_as",
  "wrong_number",
  "invented_plan_claim",
  "unresolved_citation",
  "generic_recommendation",
  "other_issue",
  "notes",
];
const labelRows = runRows.map(({ run, sameAs }) => {
  const output = run.structured_output ?? {};
  const unresolved = unresolvedCitations(run);
  return {
    run_id: run.id,
    created_at: run.created_at,
    stage: run.stage_name,
    country: run.country_code,
    unit: unitNameOf(run),
    unit_id: run.municipality_id,
    theme: run.score_id,
    model: run.model_name,
    prompt_version: run.prompt_version,
    output_chars: (run.rendered_output ?? "").length,
    output_preview: collapse(run.rendered_output).slice(0, PREVIEW_LENGTH),
    auto_number_count: countNumbers(run.rendered_output),
    // Only document stages store what the model (or parser) saw; model stages store an input hash only.
    auto_input_stored: typeof output.extractedText === "string" ? 1 : 0,
    auto_unresolved_citations: unresolved.length,
    auto_unresolved_citation_labels: unresolved.join(" | "),
    auto_same_output_as: sameAs ?? "",
    wrong_number: "",
    invented_plan_claim: "",
    unresolved_citation: "",
    generic_recommendation: "",
    other_issue: "",
    notes: "",
  };
});
const labelsPath = path.join(OUTPUT_DIR, `labels-${stamp}.csv`);
await writeFile(labelsPath, toCsv(labelColumns, labelRows));

// Document contexts CSV: extraction metadata flattened, text size, and script mix of the stored text.
const knownMetadataKeys = [
  "parser",
  "provider",
  "fallbackReason",
  "notes",
  "candidateNotes",
  "planUnitLabel",
  "localPlanUnitLabel",
  "candidateCount",
  "sourceCount",
  "pageCountHint",
  "chunkingReady",
];
const contextColumns = [
  "id",
  "created_at",
  "country",
  "source_type",
  "province",
  "title",
  "source_url_or_path",
  "status",
  "content_mode",
  "extraction_version",
  "text_chars",
  "text_chars_no_whitespace",
  "passage_count",
  "chunk_count",
  "letters",
  "devanagari_share",
  "cyrillic_share",
  "latin_share",
  ...knownMetadataKeys.map((key) => `meta_${key}`),
  "meta_sources",
  "meta_other",
  "content_fingerprint",
];
const contextRows = contexts.map((context) => {
  const metadata = context.extraction_metadata ?? {};
  const text = context.extracted_text ?? "";
  const other = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !knownMetadataKeys.includes(key) && key !== "sources"),
  );
  const row = {
    id: context.id,
    created_at: context.created_at,
    country: context.country_code,
    source_type: context.source_type,
    province: context.province,
    title: context.title,
    source_url_or_path: context.source_url_or_path,
    status: documentStatus(context),
    content_mode: context.content_mode,
    extraction_version: context.extraction_version,
    text_chars: text.length,
    text_chars_no_whitespace: text.replace(/\s/g, "").length,
    passage_count: Array.isArray(context.passages) ? context.passages.length : 0,
    chunk_count: Array.isArray(context.chunks) ? context.chunks.length : 0,
    ...scriptMix(text),
    meta_sources: Array.isArray(metadata.sources) ? metadata.sources.map((source) => source.link).join(" | ") : "",
    meta_other: Object.keys(other).length > 0 ? JSON.stringify(other) : "",
    content_fingerprint: context.content_fingerprint,
  };
  for (const key of knownMetadataKeys) {
    const value = metadata[key];
    row[`meta_${key}`] = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : value;
  }
  return row;
});
const contextsPath = path.join(OUTPUT_DIR, `document-contexts-${stamp}.csv`);
await writeFile(contextsPath, toCsv(contextColumns, contextRows));

console.log(`Wrote ${runRows.length} completed runs to ${runsPath}`);
console.log(`Wrote ${labelRows.length} label rows to ${labelsPath}`);
console.log(`Wrote ${contextRows.length} document contexts to ${contextsPath}`);
printCounts("Runs by stage", countBy(runRows, ({ run }) => run.stage_name));
printCounts("Runs by country", countBy(runRows, ({ run }) => run.country_code));
printCounts("Runs by model", countBy(runRows, ({ run }) => run.model_name));
printCounts("Runs by prompt version", countBy(runRows, ({ run }) => run.prompt_version));
printCounts("Document contexts by status", countBy(contextRows, (row) => row.status));
printCounts("Document contexts by country and type", countBy(contextRows, (row) => `${row.country}/${row.source_type}`));
printCounts(
  "Runs with an unresolved citation label",
  countBy(labelRows.filter((row) => row.auto_unresolved_citations > 0), (row) => row.stage),
);
console.log(`\nRuns with token_usage recorded: ${runs.filter((run) => Object.keys(run.token_usage ?? {}).length > 0).length}`);
