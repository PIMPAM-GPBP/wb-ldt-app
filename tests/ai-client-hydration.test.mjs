import "./support/register.mjs";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { after, before, beforeEach } from "node:test";

import { buildAiBriefMarkdownExport } from "../src/lib/ai/export.ts";

const stageRoutes = {
  indicator_narrative: "/api/ai/indicator-narrative",
  province_plan_context: "/api/ai/province-plan-context",
  national_plan_context: "/api/ai/national-plan-context",
  web_context_search: "/api/ai/web-context-search",
  plan_alignment: "/api/ai/plan-alignment",
  swot_analysis: "/api/ai/swot-analysis",
  investment_recommendations: "/api/ai/investment-recommendations",
};

const independentStages = [
  "indicator_narrative",
  "province_plan_context",
  "national_plan_context",
  "web_context_search",
];

const allStages = Object.keys(stageRoutes);

const validScope = {
  countryCode: "ZMB",
  releaseKey: "zmb-2025-v1",
  year: 2025,
  municipalityId: "zmb-eastern-eastern-chadiza",
  scoreId: "prosperity_score",
};

let fixtureServer;
let fixtureUrl;
let requestLog;
let responseModes;
let delayedStages;
let heldStages;
let heldStageResolvers;
let requestWaiters;
let dependencyBarrierViolations;
let requestAiStage;
let hydrateAiStageResults;
let clearAiDownstreamResults;
let AiStageRequestError;
let createAiStageActionCoordinator;
let prepareAiStageAction;
let runAiStageAction;

function buildResponse(stage) {
  return {
    stage,
    status: "completed",
    cacheHit: true,
    cacheStatus: "cache_hit",
    runId: `run-${stage}`,
    cacheKey: `cache-${stage}`,
    sourceFingerprint: `source-${stage}`,
    inputHash: `input-${stage}`,
    renderedOutput: `cached ${stage}`,
    structuredOutput: {},
    sourceReferences: [],
    modelName: "fixture-model",
    promptVersion: "fixture-prompt-v7",
    updatedAt: "2026-10-11T00:00:00.000Z",
    errorMessage: null,
  };
}

function buildMissingCacheResponse(stage) {
  return {
    ...buildResponse(stage),
    status: "failed",
    cacheHit: false,
    cacheStatus: "failed",
    renderedOutput: null,
    errorMessage: `No cached ${stage} found.`,
  };
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

before(async () => {
  fixtureServer = createServer(async (request, response) => {
    const stage = Object.entries(stageRoutes).find(([, route]) => route === request.url)?.[0];

    assert.equal(request.method, "POST");
    assert.ok(stage, `unknown fixture route ${request.url}`);

    const body = await readBody(request);
    requestLog.push({ stage, body });
    requestWaiters.get(stage)?.();

    if (!independentStages.includes(stage) && !independentStages.every((name) =>
      requestLog.some((entry) => entry.stage === name),
    )) {
      dependencyBarrierViolations.push(stage);
    }

    if (delayedStages.has(stage)) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    if (heldStages.has(stage)) {
      await new Promise((resolve) => {
        heldStageResolvers.set(stage, resolve);
      });
    }

    const responseMode = responseModes.get(stage) ?? "completed";

    if (responseMode === "html") {
      response.writeHead(503, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>fixture upstream failure</body></html>");
      return;
    }

    if (responseMode === "invalid_json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{not-json");
      return;
    }

    if (responseMode === "miss") {
      sendJson(response, buildMissingCacheResponse(stage));
      return;
    }

    sendJson(response, buildResponse(stage));
  });

  await new Promise((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", resolve);
  });

  fixtureUrl = `http://127.0.0.1:${fixtureServer.address().port}`;
  ({
    requestAiStage,
    hydrateAiStageResults,
    clearAiDownstreamResults,
    AiStageRequestError,
    createAiStageActionCoordinator,
    prepareAiStageAction,
    runAiStageAction,
  } = await import("../src/lib/ai/client.ts"));
});

after(async () => {
  await new Promise((resolve) => fixtureServer.close(resolve));
});

beforeEach(() => {
  requestLog = [];
  responseModes = new Map();
  delayedStages = new Set();
  heldStages = new Set();
  heldStageResolvers = new Map();
  requestWaiters = new Map();
  dependencyBarrierViolations = [];
});

function waitForStageRequest(stage) {
  if (requestLog.some((entry) => entry.stage === stage)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    requestWaiters.set(stage, resolve);
  });
}

function releaseHeldStage(stage) {
  const resolve = heldStageResolvers.get(stage);
  assert.ok(resolve, `fixture did not hold ${stage}`);
  resolve();
  heldStageResolvers.delete(stage);
}

function buildActionResults() {
  return Object.fromEntries(
    allStages.map((stage) => [
      stage,
      {
        ...buildResponse(stage),
        runId: `old-${stage}`,
        renderedOutput: `old ${stage}`,
      },
    ]),
  );
}

function exportActionResults(results) {
  return buildAiBriefMarkdownExport({
    countryName: "Zambia",
    municipalityName: "Chibombo",
    provinceName: "Central",
    scoreLabel: "Prosperity Score",
    releaseKey: validScope.releaseKey,
    year: validScope.year,
    generatedAt: "2026-10-11T00:00:00.000Z",
    stages: allStages.map((stage) => ({
      label: stage,
      result: results[stage] ?? null,
    })),
  });
}

test("cache hydration loads independent stages before valid server dependencies", async () => {
  const results = await hydrateAiStageResults(validScope, { baseUrl: fixtureUrl });

  assert.deepEqual(Object.keys(results).sort(), allStages.sort());
  assert.deepEqual(dependencyBarrierViolations, []);
  assert.deepEqual(
    Object.fromEntries(
      allStages.map((stage) => [
        stage,
        requestLog.filter((entry) => entry.stage === stage).length,
      ]),
    ),
    Object.fromEntries(allStages.map((stage) => [stage, 1])),
  );
  assert.ok(requestLog.every((entry) => entry.body.mode === "load_cached"));
});

test("ordinary cache misses stay absent and do not block valid dependencies", async () => {
  responseModes.set("web_context_search", "miss");

  const results = await hydrateAiStageResults(validScope, { baseUrl: fixtureUrl });

  assert.equal(results.web_context_search, undefined);
  assert.equal(results.plan_alignment?.status, "completed");
  assert.equal(results.swot_analysis?.status, "completed");
  assert.equal(results.investment_recommendations?.status, "completed");
});

test("missing required cache stops dependent hydration stages", async () => {
  responseModes.set("province_plan_context", "miss");

  const results = await hydrateAiStageResults(validScope, { baseUrl: fixtureUrl });

  assert.equal(results.indicator_narrative?.status, "completed");
  assert.equal(results.national_plan_context?.status, "completed");
  assert.equal(results.province_plan_context, undefined);
  assert.equal(results.plan_alignment, undefined);
  assert.equal(results.swot_analysis, undefined);
  assert.equal(results.investment_recommendations, undefined);
});

test("HTML and malformed JSON responses become visible request errors", async () => {
  responseModes.set("indicator_narrative", "html");

  await assert.rejects(
    () =>
      requestAiStage("indicator_narrative", validScope, {
        mode: "load_cached",
        baseUrl: fixtureUrl,
      }),
    (error) => {
      assert.ok(error instanceof AiStageRequestError);
      assert.match(error.message, /HTML|HTTP 503/i);
      return true;
    },
  );

  responseModes.set("indicator_narrative", "invalid_json");

  await assert.rejects(
    () =>
      requestAiStage("indicator_narrative", validScope, {
        mode: "load_cached",
        baseUrl: fixtureUrl,
      }),
    (error) => {
      assert.ok(error instanceof AiStageRequestError);
      assert.match(error.message, /invalid JSON/i);
      return true;
    },
  );
});

test("aborted stage requests stop at the shared request boundary", async () => {
  delayedStages.add("indicator_narrative");
  const controller = new AbortController();
  const request = requestAiStage("indicator_narrative", validScope, {
    mode: "load_cached",
    baseUrl: fixtureUrl,
    signal: controller.signal,
  });

  setTimeout(() => controller.abort(), 10);

  await assert.rejects(request, (error) => {
    assert.equal(error.name, "AbortError");
    return true;
  });
});

test("downstream invalidation follows the server dependency graph", () => {
  const results = Object.fromEntries(allStages.map((stage) => [stage, buildResponse(stage)]));

  const afterIndicator = clearAiDownstreamResults(results, "indicator_narrative");
  assert.ok(afterIndicator.indicator_narrative);
  assert.ok(afterIndicator.plan_alignment);
  assert.equal(afterIndicator.swot_analysis, undefined);
  assert.equal(afterIndicator.investment_recommendations, undefined);

  const afterProvince = clearAiDownstreamResults(results, "province_plan_context");
  assert.ok(afterProvince.indicator_narrative);
  assert.equal(afterProvince.plan_alignment, undefined);
  assert.equal(afterProvince.swot_analysis, undefined);
  assert.equal(afterProvince.investment_recommendations, undefined);

  const afterAlignment = clearAiDownstreamResults(results, "plan_alignment");
  assert.ok(afterAlignment.swot_analysis);
  assert.equal(afterAlignment.investment_recommendations, undefined);

  const afterWeb = clearAiDownstreamResults(results, "web_context_search");
  assert.equal(afterWeb.plan_alignment, undefined);
  assert.equal(afterWeb.swot_analysis, undefined);
  assert.equal(afterWeb.investment_recommendations, undefined);
});

test("explicit actions serialize upstream and dependent stages before export", async () => {
  heldStages.add("indicator_narrative");
  const coordinator = createAiStageActionCoordinator();
  const action = coordinator.begin(buildActionResults());
  assert.ok(action);
  prepareAiStageAction(action, "indicator_narrative");

  const narrativeTask = runAiStageAction({
    coordinator,
    action,
    stage: "indicator_narrative",
    mode: "regenerate",
    scope: validScope,
    baseUrl: fixtureUrl,
  });
  await waitForStageRequest("indicator_narrative");

  assert.equal(
    coordinator.begin(action.results),
    null,
    "a dependent explicit action cannot start while the upstream action is active",
  );
  assert.equal(
    requestLog.filter((entry) => entry.stage === "swot_analysis").length,
    0,
  );

  releaseHeldStage("indicator_narrative");
  const narrativeResult = await narrativeTask;

  assert.equal(narrativeResult.status, "applied");
  assert.equal(narrativeResult.response?.runId, "run-indicator_narrative");
  assert.equal(narrativeResult.results.swot_analysis, undefined);
  assert.equal(narrativeResult.results.investment_recommendations, undefined);
  assert.doesNotMatch(exportActionResults(narrativeResult.results), /old swot_analysis/);
  coordinator.finish(action);
});

test("failed upstream actions clear dependent results from the exported brief", async () => {
  heldStages.add("indicator_narrative");
  responseModes.set("indicator_narrative", "html");
  const coordinator = createAiStageActionCoordinator();
  const action = coordinator.begin(buildActionResults());
  assert.ok(action);
  prepareAiStageAction(action, "indicator_narrative");

  const narrativeTask = runAiStageAction({
    coordinator,
    action,
    stage: "indicator_narrative",
    mode: "regenerate",
    scope: validScope,
    baseUrl: fixtureUrl,
  });
  await waitForStageRequest("indicator_narrative");
  releaseHeldStage("indicator_narrative");
  const narrativeResult = await narrativeTask;

  assert.equal(narrativeResult.status, "applied");
  assert.equal(narrativeResult.response?.status, "failed");
  assert.equal(narrativeResult.results.indicator_narrative?.status, "failed");
  assert.equal(narrativeResult.results.swot_analysis, undefined);
  assert.equal(narrativeResult.results.investment_recommendations, undefined);

  const markdown = exportActionResults(narrativeResult.results);
  assert.match(markdown, /## indicator_narrative[\s\S]*Status: failed/);
  assert.match(markdown, /## swot_analysis[\s\S]*Status: not generated/);
  assert.doesNotMatch(markdown, /old swot_analysis|old investment_recommendations/);
  coordinator.finish(action);
});
