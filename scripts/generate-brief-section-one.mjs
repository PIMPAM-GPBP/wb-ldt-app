#!/usr/bin/env node
// Generates section one prose for the golden set and verifies every sentence against its fact sheet.
//
// Paid: one OpenAI call per unit and pillar. A call starts only if the spend so far, plus the
// worst case of every call in flight, stays under --max-usd. Nothing is written to Supabase;
// results go to data/brief-review/section-one-<date>.jsonl for the review page.
//
// Usage: node scripts/generate-brief-section-one.mjs [--max-usd 1] [--limit N] [--concurrency 4] [--date YYYYMMDD]
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_REQUEST_TIMEOUT_MS,
  buildOpenAiRequestBody,
  estimateOpenAiCostUsd,
  openAiPriceTable,
  readOpenAiResponse,
  resolveOpenAiRequestSettings,
} from "../src/lib/ai/openai-request.ts";
import { FACT_SHEET_VERSION } from "../src/lib/brief/facts.ts";
import {
  SECTION_ONE_MODEL_SETTINGS,
  SECTION_ONE_PROMPT_VERSION,
  SECTION_ONE_SYSTEM_PROMPT,
  buildSectionOnePrompt,
  parseSectionOneOutput,
  sectionOneFormat,
} from "../src/lib/brief/prompt.ts";
import { renderSectionOne } from "../src/lib/brief/section-one.ts";
import { verifySentences } from "../src/lib/brief/verify.ts";
import { loadLocalEnv } from "./lib/load-env.mjs";

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const maxUsd = Number(option("max-usd", "1"));
const limit = Number(option("limit", "Infinity"));
const concurrency = Number(option("concurrency", "4"));
const date = option("date", new Date().toISOString().slice(0, 10).replaceAll("-", ""));

await loadLocalEnv();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const price = openAiPriceTable[model];
if (!price) throw new Error(`No price for ${model}, so the spend cap cannot be enforced.`);

const golden = JSON.parse(readFileSync("src/lib/brief/golden-set.json", "utf8"));
if (golden.factSheetVersion !== FACT_SHEET_VERSION) {
  throw new Error(`Golden set is fact sheet v${golden.factSheetVersion}, code is v${FACT_SHEET_VERSION}; rerun scripts/build-brief-golden-set.mjs.`);
}

const jobs = golden.units
  .flatMap((unit) => {
    const sheet = JSON.parse(readFileSync(`tests/fixtures/brief/fact-sheets/${unit.country.toLowerCase()}/${unit.unitKey}.json`, "utf8"));
    return sheet.pillars.map((pillar) => ({ unit, sheet, pillar: pillar.key }));
  })
  .slice(0, limit);

const outDir = "data/brief-review";
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `section-one-${date}.jsonl`);
writeFileSync(outPath, "");

let spent = 0;
let reserved = 0;
let skipped = 0;
const settings = resolveOpenAiRequestSettings(model, SECTION_ONE_MODEL_SETTINGS, sectionOneFormat);

async function run(job) {
  const prompt = buildSectionOnePrompt(job.sheet, job.pillar);
  // Worst case: every input token at full price and the whole output budget used.
  const worstCase = ((prompt.length + SECTION_ONE_SYSTEM_PROMPT.length) / 3 / 1e6) * price.input + (settings.max_output_tokens / 1e6) * price.output;
  if (spent + reserved + worstCase > maxUsd) {
    skipped += 1;
    return;
  }
  reserved += worstCase;
  const started = Date.now();
  const record = {
    country: job.unit.country,
    unitKey: job.unit.unitKey,
    unitName: job.unit.name,
    pillar: job.pillar,
    model,
    promptVersion: SECTION_ONE_PROMPT_VERSION,
    factSheetVersion: FACT_SHEET_VERSION,
    template: renderSectionOne(job.sheet, job.pillar).map(({ text, factIds }) => ({ text, factIds })),
  };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildOpenAiRequestBody({ model, system: SECTION_ONE_SYSTEM_PROMPT, prompt, settings })),
      signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    const { text, usage } = readOpenAiResponse(await response.json());
    const cost = estimateOpenAiCostUsd(model, usage) ?? worstCase;
    spent += cost;
    const parsed = parseSectionOneOutput(text);
    Object.assign(record, {
      status: parsed.ok ? "completed" : "unparseable",
      error: parsed.ok ? null : parsed.error,
      raw: parsed.ok ? null : text,
      sentences: parsed.ok ? verifySentences(job.sheet, parsed.sentences) : [],
      usage,
      costUsd: cost,
    });
  } catch (error) {
    spent += worstCase;
    Object.assign(record, { status: "failed", error: error instanceof Error ? error.message : String(error), sentences: [], usage: null, costUsd: null });
  } finally {
    reserved -= worstCase;
  }
  record.ms = Date.now() - started;
  appendFileSync(outPath, `${JSON.stringify(record)}\n`);
  const passed = record.sentences.filter((sentence) => sentence.problems.length === 0).length;
  console.log(`${record.country} ${record.unitName} ${record.pillar}: ${record.status}, ${passed}/${record.sentences.length} sentences pass, $${(record.costUsd ?? 0).toFixed(5)}`);
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) await run(queue.shift());
  }),
);

const records = readFileSync(outPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const sentences = records.flatMap((record) => record.sentences);
const problems = new Map();
for (const sentence of sentences) {
  for (const problem of sentence.problems) {
    const kind = problem.replace(/^"[^"]*" matches/, "a number matches").replace(/"[^"]*"/g, "a phrase").replace(/compares \w+/, "compares X").replace(/names .+ without/, "names X without").replace(/unknown fact \S+/, "unknown fact X");
    problems.set(kind, (problems.get(kind) ?? 0) + 1);
  }
}
console.log(`\n${records.length} calls (${skipped} skipped by the $${maxUsd} cap), $${spent.toFixed(4)} spent, model ${model}`);
console.log(`${records.filter((record) => record.status === "completed").length} completed, ${records.filter((record) => record.status !== "completed").length} unparseable or failed`);
console.log(`${sentences.length} sentences, ${sentences.filter((sentence) => sentence.problems.length === 0).length} pass, ${sentences.filter((sentence) => sentence.problems.length > 0).length} dropped`);
for (const [kind, count] of [...problems].sort((a, b) => b[1] - a[1])) console.log(`  ${count} × ${kind}`);
console.log(`Results in ${outPath}`);
