#!/usr/bin/env node
// Extracts commitments from plans in the plan store and keeps only quotes found in the plan's text.
//
// Paid: one OpenAI call per chunk of 25 readable pages. A call starts only if the spend so far,
// plus the worst case of every call in flight, stays under --max-usd. Nothing is written to
// Supabase; results go to data/plan-store/commitments-<date>.jsonl, one line per plan.
//
// Usage: node scripts/extract-plan-commitments.mjs [--scope golden|all] [--plans id,id] [--max-chunks N]
//          [--max-usd 1] [--concurrency 4] [--date YYYYMMDD]
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_REQUEST_TIMEOUT_MS,
  buildOpenAiRequestBody,
  estimateOpenAiCostUsd,
  openAiPriceTable,
  readOpenAiResponse,
  resolveOpenAiRequestSettings,
} from "../src/lib/ai/openai-request.ts";
import { countries } from "../src/lib/countries.ts";
import {
  EXTRACTION_MODEL_SETTINGS,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  chunkPages,
  commitmentFormat,
  parseCommitmentOutput,
  verifyCommitments,
} from "../src/lib/plans/extract.ts";
import { loadLocalEnv } from "./lib/load-env.mjs";

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const scope = option("scope", "golden");
const onlyPlans = option("plans", null)?.split(",");
const maxChunks = Number(option("max-chunks", "Infinity"));
const maxUsd = Number(option("max-usd", "1"));
const concurrency = Number(option("concurrency", "4"));
const date = option("date", new Date().toISOString().slice(0, 10).replaceAll("-", ""));

await loadLocalEnv();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const price = openAiPriceTable[model];
if (!price) throw new Error(`No price for ${model}, so the spend cap cannot be enforced.`);

const normalizeName = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const { documents } = JSON.parse(readFileSync("data/plan-store/documents.json", "utf8"));
const golden = JSON.parse(readFileSync("src/lib/brief/golden-set.json", "utf8")).units;
const goldenNames = new Set(golden.map((unit) => `${unit.country}|${normalizeName(unit.name)}`));
const plans = documents.filter((document) => {
  if (document.status !== "text") return false;
  if (onlyPlans) return onlyPlans.includes(document.id);
  if (scope === "all") return true;
  return document.level === "national" || document.units.some((unit) => goldenNames.has(`${document.country}|${normalizeName(unit)}`));
});

// The components are the same in every country; read them from one dataset.
const dataset = JSON.parse(readFileSync(countries[0].fallbackDataPath, "utf8"));
const components = dataset.scoreDefinitions.flatMap((definition) =>
  definition.componentIds.map((id, index) => ({ key: id.replace(/_score$/, ""), label: definition.componentLabels[index], pillar: definition.pillar })),
);
const componentKeys = new Set(components.map((component) => component.key));
const settings = resolveOpenAiRequestSettings(model, EXTRACTION_MODEL_SETTINGS, commitmentFormat);

const jobs = [];
const perPlan = new Map();
for (const plan of plans) {
  const { pages } = JSON.parse(readFileSync(`data/plan-store/pages/${plan.id}.json`, "utf8"));
  const chunks = chunkPages(pages).slice(0, maxChunks);
  perPlan.set(plan.id, { plan, pages, chunks: chunks.length, raw: [], failures: [], usage: [], cost: 0, remaining: chunks.length });
  chunks.forEach((chunk, index) => jobs.push({ plan, chunk, index }));
}

const outPath = `data/plan-store/commitments-${date}.jsonl`;
writeFileSync(outPath, "");
let spent = 0;
let reserved = 0;
let skipped = 0;

function finishPlan(state) {
  const { kept, dropped } = verifyCommitments(state.raw, state.pages, componentKeys);
  const record = {
    id: state.plan.id,
    url: state.plan.url,
    country: state.plan.country,
    level: state.plan.level,
    title: state.plan.title,
    units: state.plan.units,
    model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    chunks: state.chunks,
    failedChunks: state.failures,
    rawCount: state.raw.length,
    kept,
    dropped,
    usage: state.usage,
    costUsd: state.cost,
  };
  appendFileSync(outPath, `${JSON.stringify(record)}\n`);
  console.log(`${state.plan.country} ${state.plan.units.slice(0, 2).join(", ") || state.plan.title}: ${state.chunks} chunks, ${kept.length} kept, ${dropped.length} dropped, $${state.cost.toFixed(4)}`);
}

async function run(job) {
  const state = perPlan.get(job.plan.id);
  const prompt = buildExtractionPrompt(job.plan, job.chunk, components);
  const worstCase = ((prompt.length + EXTRACTION_SYSTEM_PROMPT.length) / 3 / 1e6) * price.input + (settings.max_output_tokens / 1e6) * price.output;
  if (spent + reserved + worstCase > maxUsd) {
    skipped += 1;
    state.failures.push({ chunk: job.index, error: "skipped by the spend cap" });
  } else {
    reserved += worstCase;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildOpenAiRequestBody({ model, system: EXTRACTION_SYSTEM_PROMPT, prompt, settings })),
        signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
      const { text, usage } = readOpenAiResponse(await response.json());
      const cost = estimateOpenAiCostUsd(model, usage) ?? worstCase;
      spent += cost;
      state.cost += cost;
      state.usage.push(usage);
      const parsed = parseCommitmentOutput(text);
      if (parsed.ok) state.raw.push(...parsed.commitments);
      else state.failures.push({ chunk: job.index, error: parsed.error });
    } catch (error) {
      spent += worstCase;
      state.cost += worstCase;
      state.failures.push({ chunk: job.index, error: error instanceof Error ? error.message : String(error) });
    } finally {
      reserved -= worstCase;
    }
  }
  state.remaining -= 1;
  if (state.remaining === 0) finishPlan(state);
}

const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  while (queue.length > 0) await run(queue.shift());
}));

const records = readFileSync(outPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
for (const country of [...new Set(records.map((record) => record.country))]) {
  const mine = records.filter((record) => record.country === country);
  const kept = mine.flatMap((record) => record.kept);
  const dropped = mine.flatMap((record) => record.dropped);
  // The match rate counts quotes the brief could use: too-short items are dropped by rule, and reported apart.
  const quoted = kept.length + dropped.filter((entry) => entry.reason === "quote unmatched").length;
  const reasons = {};
  for (const entry of dropped) reasons[entry.reason] = (reasons[entry.reason] ?? 0) + 1;
  console.log(
    `\n${country}: ${mine.length} plans, ${kept.length} commitments kept (${kept.filter((entry) => entry.match === "exact").length} exact, ${kept.filter((entry) => entry.match === "fuzzy").length} fuzzy, ` +
      `${kept.filter((entry) => entry.page !== entry.citedPage).length} on a different page than cited); quote match rate ${quoted ? ((100 * kept.length) / quoted).toFixed(1) : "n/a"}%; dropped ${JSON.stringify(reasons)}`,
  );
}
console.log(`\n${jobs.length} chunks (${skipped} skipped by the $${maxUsd} cap), $${spent.toFixed(4)} spent, model ${model}, prompt ${EXTRACTION_PROMPT_VERSION}`);
console.log(`Results in ${outPath}`);
