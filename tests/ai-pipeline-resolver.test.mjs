import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { after, before, beforeEach } from "node:test";

const fixtureRelease = {
  id: "release-zmb-2025",
  country_code: "ZMB",
  release_key: "zmb-2025-v1",
  year: 2025,
  label: "Zambia 2025",
  admin_file_name: null,
  score_file_name: null,
  geojson_file_name: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

const fixtureMunicipality = {
  id: "zmb-eastern-eastern-chadiza",
  country_code: "ZMB",
  municipality: "Chadiza",
  district: "Eastern",
  province: "Eastern",
  municipality_slug: "chadiza",
  district_slug: "eastern",
  province_slug: "eastern",
  composite_key: "Eastern::Eastern::Chadiza",
};

const fixtureScoreDefinitions = [
  {
    id: "infrastructure_score",
    canonical_name: "Infrastructure Score",
    pillar: "infrastructure",
    description: null,
    component_score_keys: [],
    display_order: 1,
  },
  {
    id: "livability_score",
    canonical_name: "Livability Score",
    pillar: "livability",
    description: null,
    component_score_keys: [],
    display_order: 2,
  },
  {
    id: "prosperity_score",
    canonical_name: "Prosperity Score",
    pillar: "prosperity",
    description: null,
    component_score_keys: [],
    display_order: 3,
  },
];

const fixtureProvincePlanSource = {
  country_code: "ZMB",
  plan_level: "province",
  province: "Eastern",
  title: "Eastern fixture plan",
  link: "https://example.test/eastern-plan.pdf",
  notes: null,
  priority: 1,
  document_type: "local_plan",
  score_theme: null,
  is_active: true,
};

const fixtureNationalPlanSource = {
  country_code: "ZMB",
  plan_level: "national",
  province: null,
  title: "Zambia fixture national plan",
  link: "https://example.test/zambia-plan.pdf",
  notes: null,
  priority: 1,
  document_type: "national_plan",
  score_theme: "prosperity",
  is_active: true,
};

let fixtureServer;
let fixtureUrl;
let sourceRows = [fixtureProvincePlanSource, fixtureNationalPlanSource];
const cacheQueryLog = [];
const forbiddenRequests = [];
let nullProvinceCacheKey;
let runAiStage;
let loadProvincePlanCandidates;
let buildAiRunCacheContract;
let getAiPromptVersion;
let getAiInvalidationVersion;
let toStageErrorResponse;

function sendJson(response, body, headers = {}) {
  response.writeHead(200, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function queryValue(searchParams, key) {
  const value = searchParams.get(key);
  return value?.startsWith("eq.") ? value.slice(3) : value;
}

function hasCurrentContract(searchParams) {
  return [
    "model_name",
    "prompt_version",
    "invalidation_version",
    "input_fingerprint",
  ].every((key) => searchParams.has(key));
}

function documentOutput(stage, current) {
  if (!current) {
    return {};
  }

  const isProvince = stage === "province_plan_context";
  const source = isProvince ? fixtureProvincePlanSource : fixtureNationalPlanSource;

  return {
    countryCode: "ZMB",
    sourceType: isProvince ? "province_plan" : "national_plan",
    title: source.title,
    province: isProvince ? "Eastern" : null,
    sourceUrlOrPath: source.link,
    contentMode: "full_text",
    extractedText: `Current ${stage} fixture evidence`,
    extractionMetadata: { fixture: true },
    passages: [
      {
        id: `fixture-${stage}`,
        title: null,
        text: `Current ${stage} fixture evidence with enough text for reconstruction.`,
      },
    ],
    chunks: [],
    contentFingerprint: `current-${stage}-fingerprint`,
    extractionVersion: "v2",
  };
}

function cacheRow(stage, current) {
  const modelName =
    stage === "province_plan_context" || stage === "national_plan_context"
      ? "document-parser"
      : "fixture-model";

  return {
    stage_name: stage,
    status: "completed",
    rendered_output: current ? `current:${stage}` : `legacy:${stage}`,
    structured_output: documentOutput(stage, current),
    source_references: [],
    model_name: current ? modelName : "legacy-model",
    prompt_version: current ? "fixture-prompt-v7" : "legacy-prompt",
    invalidation_version: "fixture-invalidation-v1",
    updated_at: current ? "2026-10-11T00:00:00.000Z" : "2026-01-01T00:00:00.000Z",
    error_message: null,
    latest_run_id: `${current ? "current" : "legacy"}-${stage}-run`,
    cache_key: `${current ? "current" : "legacy"}-${stage}-cache`,
    source_fingerprint: `${current ? "current" : "legacy"}-${stage}-source`,
    input_hash: `${current ? "current" : "legacy"}-${stage}-input`,
  };
}

before(async () => {
  fixtureServer = createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      forbiddenRequests.push({ method: request.method, url: request.url });
      response.writeHead(405, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture rejects writes" }));
      return;
    }

    const requestUrl = new URL(request.url, fixtureUrl ?? "http://127.0.0.1");
    const table = requestUrl.pathname.split("/").at(-1);

    if (request.method === "HEAD") {
      response.writeHead(200, { "content-range": "0-0/1" });
      response.end();
      return;
    }

    if (table === "ai_stage_cache") {
      const stage = queryValue(requestUrl.searchParams, "stage_name");
      const current = hasCurrentContract(requestUrl.searchParams);
      cacheQueryLog.push({
        stage,
        current,
        inputFingerprint: queryValue(requestUrl.searchParams, "input_fingerprint"),
      });

      if (
        current &&
        stage === "province_plan_context" &&
        queryValue(requestUrl.searchParams, "input_fingerprint") === nullProvinceCacheKey
      ) {
        return sendJson(response, []);
      }

      if (current && stage === "web_context_search") {
        return sendJson(response, []);
      }

      return sendJson(response, [cacheRow(stage, current)]);
    }

    const rows = {
      dataset_releases: [fixtureRelease],
      municipalities: [fixtureMunicipality],
      score_definitions: fixtureScoreDefinitions,
      indicators: [],
      score_components: [],
      municipality_score_values: [],
      municipality_indicator_values: [],
      municipality_score_component_values: [],
      municipality_context_values: [],
      plan_document_sources: sourceRows,
    }[table] ?? [];

    sendJson(response, rows);
  });

  await new Promise((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", resolve);
  });

  fixtureUrl = `http://127.0.0.1:${fixtureServer.address().port}`;
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixtureUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "ai-resolver-test-fixture-key";
  process.env.AI_PROMPT_VERSION = "fixture-prompt-v7";
  process.env.AI_INVALIDATION_VERSION = "fixture-invalidation-v1";
  process.env.OPENAI_MODEL = "fixture-model";

  ({ runAiStage } = await import("../src/lib/ai/pipeline.ts"));
  ({ loadProvincePlanCandidates } = await import("../src/lib/ai/documents.ts"));
  ({ getAiPromptVersion, getAiInvalidationVersion } =
    await import("../src/lib/ai/cache.ts"));
  ({ buildAiRunCacheContract } = await import("../src/lib/ai/run-store.ts"));
  ({ toStageErrorResponse } = await import("../src/app/api/ai/_utils.ts"));

  const nullProvinceInput = {
    countryCode: fixtureRelease.country_code,
    localPlanUnitName: fixtureMunicipality.province,
    selectedPlanUrl: null,
    evidence: [],
    extractionVersion: "v2",
    displayVersion: "v2",
  };
  nullProvinceCacheKey = buildAiRunCacheContract({
    countryCode: fixtureRelease.country_code,
    stage: "province_plan_context",
    releaseKey: fixtureRelease.release_key,
    year: fixtureRelease.year,
    municipalityId: fixtureMunicipality.id,
    province: fixtureMunicipality.province,
    scoreId: "prosperity_score",
    modelName: "document-parser",
    promptVersion: getAiPromptVersion(),
    invalidationVersion: getAiInvalidationVersion(),
    input: nullProvinceInput,
    prompt: {
      system: "document-parser",
      user: JSON.stringify(nullProvinceInput),
    },
    modelSettings: {},
  }).cacheKey;
});

after(async () => {
  await new Promise((resolve) => fixtureServer.close(resolve));
});

beforeEach(() => {
  sourceRows = [fixtureProvincePlanSource, fixtureNationalPlanSource];
  cacheQueryLog.length = 0;
  forbiddenRequests.length = 0;
});

const validPayload = {
  countryCode: "ZMB",
  releaseKey: fixtureRelease.release_key,
  year: fixtureRelease.year,
  municipalityId: fixtureMunicipality.id,
  scoreId: "prosperity_score",
  mode: "load_cached",
};

test("fresh plan source reads do not stay process-cached", async () => {
  const first = await loadProvincePlanCandidates("ZMB");
  assert.equal(first[0]?.link, fixtureProvincePlanSource.link);

  const refreshedLink = "https://example.test/eastern-plan-revised.pdf";
  sourceRows = [
    { ...fixtureProvincePlanSource, link: refreshedLink },
    fixtureNationalPlanSource,
  ];

  const second = await loadProvincePlanCandidates("ZMB");
  assert.equal(second[0]?.link, refreshedLink);
});

test("cache-only SWOT resolves current contracts and a current nested plan candidate", async () => {
  const response = await runAiStage("swot_analysis", validPayload);

  assert.equal(response.status, "completed");
  assert.equal(response.renderedOutput, "current:swot_analysis");
  assert.deepEqual(
    Object.fromEntries(cacheQueryLog.map(({ stage }) => [stage, cacheQueryLog.filter((query) => query.stage === stage).length])),
    {
      indicator_narrative: 1,
      province_plan_context: 1,
      national_plan_context: 1,
      web_context_search: 1,
      swot_analysis: 1,
    },
  );
  assert.ok(cacheQueryLog.every((query) => query.current));
  assert.equal(forbiddenRequests.length, 0);
});

test("cache-only recommendations deduplicate every dependency path", async () => {
  const response = await runAiStage("investment_recommendations", validPayload);

  assert.equal(response.status, "completed");
  assert.equal(response.renderedOutput, "current:investment_recommendations");
  assert.deepEqual(
    Object.fromEntries(cacheQueryLog.map(({ stage }) => [stage, cacheQueryLog.filter((query) => query.stage === stage).length])),
    {
      indicator_narrative: 1,
      province_plan_context: 1,
      national_plan_context: 1,
      web_context_search: 1,
      plan_alignment: 1,
      swot_analysis: 1,
      investment_recommendations: 1,
    },
  );
  assert.ok(cacheQueryLog.every((query) => query.current));
  assert.equal(forbiddenRequests.length, 0);
});

test("failure responses use the active prompt version", async () => {
  const configuredPromptVersion = process.env.AI_PROMPT_VERSION;
  delete process.env.AI_PROMPT_VERSION;

  try {
    const response = toStageErrorResponse("swot_analysis", new Error("fixture failure"));
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.promptVersion, "v2");
  } finally {
    process.env.AI_PROMPT_VERSION = configuredPromptVersion;
  }
});
