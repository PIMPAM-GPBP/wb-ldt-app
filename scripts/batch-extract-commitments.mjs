#!/usr/bin/env node
// Commitment extraction through OpenAI's Batch API, at about half the live price.
//
//   submit   Builds one request per chunk of 25 readable pages for text plans in neither --reuse
//            (a live run's JSONL) nor an earlier batch, and submits them. --max-plans N sends only
//            the first N of those, so one batch's real cost can be checked before the next.
//            Refuses when the estimate, from --reuse's actual cost per chunk, would pass --max-usd
//            together with what earlier batches in data/plan-store/batches/ cost.
//   status   Prints a batch's state and request counts.
//   collect  Downloads a finished batch, verifies every quote against the plan's text, and writes
//            data/plan-store/commitments-batch-<id>.jsonl in the live runs' record format.
//
// Usage: node scripts/batch-extract-commitments.mjs submit --reuse <jsonl> [--max-plans 80] [--max-usd 5]
//        node scripts/batch-extract-commitments.mjs status <batch id>
//        node scripts/batch-extract-commitments.mjs collect <batch id>
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_OPENAI_MODEL, buildOpenAiRequestBody, estimateOpenAiCostUsd, readOpenAiResponse, resolveOpenAiRequestSettings } from "../src/lib/ai/openai-request.ts";
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

// OpenAI bills Batch API calls at half the live price; the price table holds live prices.
const BATCH_DISCOUNT = 0.5;
const BATCH_DIR = "data/plan-store/batches";

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? fallback : rest[index + 1];
};

await loadLocalEnv();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
const api = async (pathname, init = {}) => {
  const response = await fetch(`https://api.openai.com/v1${pathname}`, { ...init, headers: { authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`OpenAI ${pathname} failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  return response;
};

const dataset = JSON.parse(readFileSync(countries[0].fallbackDataPath, "utf8"));
const components = dataset.scoreDefinitions.flatMap((definition) =>
  definition.componentIds.map((id, index) => ({ key: id.replace(/_score$/, ""), label: definition.componentLabels[index], pillar: definition.pillar })),
);
const componentKeys = new Set(components.map((component) => component.key));
const { documents } = JSON.parse(readFileSync("data/plan-store/documents.json", "utf8"));
const pagesOf = (id) => JSON.parse(readFileSync(`data/plan-store/pages/${id}.json`, "utf8")).pages;
const readJsonl = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

function earlierBatches() {
  if (!existsSync(BATCH_DIR)) return [];
  return readdirSync(BATCH_DIR).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(readFileSync(path.join(BATCH_DIR, file), "utf8")));
}

if (command === "submit") {
  const reusePath = option("reuse", null);
  if (!reusePath) throw new Error("Pass --reuse with the live run whose plans should not be read again.");
  const reuse = readJsonl(reusePath);
  if (reuse.some((record) => record.promptVersion !== EXTRACTION_PROMPT_VERSION)) {
    throw new Error(`--reuse holds a different prompt version than ${EXTRACTION_PROMPT_VERSION}.`);
  }
  const maxPlans = Number(option("max-plans", "Infinity"));
  const maxUsd = Number(option("max-usd", "5"));

  const done = new Set([...reuse.map((record) => record.id), ...earlierBatches().flatMap((batch) => batch.plans)]);
  const plans = documents.filter((document) => document.status === "text" && !done.has(document.id));
  const slice = plans.slice(0, maxPlans);

  const settings = resolveOpenAiRequestSettings(model, EXTRACTION_MODEL_SETTINGS, commitmentFormat);
  const lines = [];
  for (const plan of slice) {
    chunkPages(pagesOf(plan.id)).forEach((chunk, index) => {
      lines.push(JSON.stringify({
        custom_id: `${plan.id}:${index}`,
        method: "POST",
        url: "/v1/responses",
        body: buildOpenAiRequestBody({ model, system: EXTRACTION_SYSTEM_PROMPT, prompt: buildExtractionPrompt(plan, chunk, components), settings }),
      }));
    });
  }

  // Estimate from what the live run actually cost per chunk, at the batch discount.
  const liveCostPerChunk = reuse.reduce((sum, record) => sum + record.costUsd, 0) / reuse.reduce((sum, record) => sum + record.chunks, 0);
  const estimate = lines.length * liveCostPerChunk * BATCH_DISCOUNT;
  const spent = earlierBatches().reduce((sum, batch) => sum + (batch.costUsd ?? batch.estimateUsd), 0);
  console.log(`${slice.length} plans, ${lines.length} chunks; estimate $${estimate.toFixed(2)} at $${(liveCostPerChunk * BATCH_DISCOUNT).toFixed(5)} a chunk; earlier batches $${spent.toFixed(2)}; cap $${maxUsd}`);
  if (spent + estimate > maxUsd) throw new Error("This batch would pass the spend cap; submit a smaller part.");
  if (lines.length === 0) throw new Error("Nothing to submit.");

  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([`${lines.join("\n")}\n`], { type: "application/jsonl" }), `brief-commitments-${slice.length}-plans.jsonl`);
  const file = await (await api("/files", { method: "POST", body: form })).json();
  const batch = await (await api("/batches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h", metadata: { purpose: "ldt brief commitments", prompt: EXTRACTION_PROMPT_VERSION } }),
  })).json();

  mkdirSync(BATCH_DIR, { recursive: true });
  writeFileSync(path.join(BATCH_DIR, `${batch.id}.json`), `${JSON.stringify({
    id: batch.id, inputFileId: file.id, model, promptVersion: EXTRACTION_PROMPT_VERSION,
    plans: slice.map((plan) => plan.id), chunks: lines.length, estimateUsd: estimate, costUsd: null, submittedAt: new Date().toISOString(),
  }, null, 2)}\n`);
  console.log(`Submitted ${batch.id} (${batch.status}).`);
} else if (command === "status") {
  const batch = await (await api(`/batches/${rest[0]}`)).json();
  console.log(`${batch.id}: ${batch.status}; ${JSON.stringify(batch.request_counts)}${batch.errors ? `; errors ${JSON.stringify(batch.errors).slice(0, 300)}` : ""}`);
} else if (command === "collect") {
  const statePath = path.join(BATCH_DIR, `${rest[0]}.json`);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const batch = await (await api(`/batches/${state.id}`)).json();
  if (batch.status !== "completed") throw new Error(`Batch ${state.id} is ${batch.status}, not completed.`);
  const results = batch.output_file_id ? (await (await api(`/files/${batch.output_file_id}/content`)).text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
  const errors = batch.error_file_id ? (await (await api(`/files/${batch.error_file_id}/content`)).text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];

  const perPlan = new Map(state.plans.map((id) => [id, { raw: [], failures: [], usage: [], cost: 0, chunks: 0 }]));
  for (const result of results) {
    const [planId, chunk] = result.custom_id.split(":");
    const entry = perPlan.get(planId);
    entry.chunks += 1;
    if (result.response?.status_code !== 200) {
      entry.failures.push({ chunk: Number(chunk), error: `HTTP ${result.response?.status_code}` });
      continue;
    }
    try {
      const { text, usage } = readOpenAiResponse(result.response.body);
      entry.usage.push(usage);
      entry.cost += (estimateOpenAiCostUsd(model, usage) ?? 0) * BATCH_DISCOUNT;
      const parsed = parseCommitmentOutput(text);
      if (parsed.ok) entry.raw.push(...parsed.commitments);
      else entry.failures.push({ chunk: Number(chunk), error: parsed.error });
    } catch (error) {
      entry.failures.push({ chunk: Number(chunk), error: error instanceof Error ? error.message : String(error) });
    }
  }
  for (const error of errors) {
    const [planId, chunk] = error.custom_id.split(":");
    perPlan.get(planId)?.failures.push({ chunk: Number(chunk), error: JSON.stringify(error.error ?? error.response?.body ?? "error").slice(0, 200) });
  }

  const outPath = `data/plan-store/commitments-batch-${state.id}.jsonl`;
  const lines = [];
  for (const [planId, entry] of perPlan) {
    const plan = documents.find((document) => document.id === planId);
    const { kept, dropped } = verifyCommitments(entry.raw, pagesOf(planId), componentKeys);
    lines.push(JSON.stringify({
      id: plan.id, url: plan.url, country: plan.country, level: plan.level, title: plan.title, units: plan.units,
      model: state.model, promptVersion: state.promptVersion, batchId: state.id, chunks: entry.chunks, failedChunks: entry.failures,
      rawCount: entry.raw.length, kept, dropped, usage: entry.usage, costUsd: entry.cost,
    }));
  }
  writeFileSync(outPath, `${lines.join("\n")}\n`);
  const cost = [...perPlan.values()].reduce((sum, entry) => sum + entry.cost, 0);
  writeFileSync(statePath, `${JSON.stringify({ ...state, costUsd: cost, collectedAt: new Date().toISOString(), outputPath: outPath }, null, 2)}\n`);
  const kept = [...perPlan.values()].length;
  console.log(`${results.length} results, ${errors.length} errors, ${kept} plans; cost $${cost.toFixed(4)}. Wrote ${outPath}`);
} else {
  throw new Error("Use submit, status, or collect.");
}
