import "./support/register.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  province: "Chadiza",
  title: "Eastern fixture plan",
  link: "http://127.0.0.1/fixture-province-plan.html",
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
  link: "http://127.0.0.1/fixture-national-plan.html",
  notes: null,
  priority: 1,
  document_type: "national_plan",
  score_theme: "prosperity",
  is_active: true,
};

const oldProvinceContext = {
  country_code: "ZMB",
  source_type: "province_plan",
  title: "Stored Eastern plan",
  province: "Chadiza",
  source_url_or_path: fixtureProvincePlanSource.link,
  content_mode: "full_text",
  extracted_text: "Stored previous Eastern plan content.",
  passages: [],
  chunks: [],
  extraction_metadata: { fixture: "stored" },
  content_fingerprint: createHash("sha256")
    .update("stored document revision with current evidence.")
    .digest("hex"),
  extraction_version: "v2",
};

const oldNationalContext = {
  country_code: "ZMB",
  source_type: "national_plan",
  title: "Stored Zambia national plan",
  province: null,
  source_url_or_path: "fixture-national-source-collection",
  content_mode: "full_text",
  extracted_text: "Stored previous national plan content.",
  passages: [],
  chunks: [],
  extraction_metadata: { fixture: "stored" },
  content_fingerprint: "stored-national-fingerprint",
  extraction_version: "v2",
};

let supabaseServer;
let documentServer;
let supabaseUrl;
let documentUrl;
let documentRevision = "stored";
let sourceRows = [fixtureProvincePlanSource, fixtureNationalPlanSource];
let documentContexts = [oldProvinceContext, oldNationalContext];
let documentFetchUrls = [];
let writes = [];
let getProvincePlanContext;
let getNationalPlanContext;
let runAiStage;

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

function buildDocumentCacheRow(stage) {
  const isProvince = stage === "province_plan_context";
  const source = isProvince ? fixtureProvincePlanSource : fixtureNationalPlanSource;

  return {
    stage_name: stage,
    status: "completed",
    rendered_output: `cached ${stage}`,
    structured_output: {
      countryCode: "ZMB",
      sourceType: isProvince ? "province_plan" : "national_plan",
      title: source.title,
      province: isProvince ? "Eastern" : null,
      sourceUrlOrPath: source.link,
      contentMode: "full_text",
      extractedText: `Cached ${stage} content`,
      extractionMetadata: { fixture: true },
      passages: [],
      chunks: [],
      contentFingerprint: `cached-${stage}-fingerprint`,
      extractionVersion: "v2",
    },
    source_references: [],
    model_name: "document-parser",
    prompt_version: "fixture-prompt-v7",
    invalidation_version: "fixture-invalidation-v1",
    updated_at: "2026-10-11T00:00:00.000Z",
    error_message: null,
    latest_run_id: `cached-${stage}-run`,
    cache_key: `cached-${stage}-cache`,
    source_fingerprint: `cached-${stage}-source`,
    input_hash: `cached-${stage}-input`,
  };
}

before(async () => {
  documentServer = createServer((request, response) => {
    documentFetchUrls.push(request.url);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<html><body>${documentRevision} document revision with current evidence.</body></html>`,
    );
  });

  await new Promise((resolve, reject) => {
    documentServer.once("error", reject);
    documentServer.listen(0, "127.0.0.1", resolve);
  });

  documentUrl = `http://127.0.0.1:${documentServer.address().port}`;
  sourceRows = [
    { ...fixtureProvincePlanSource, link: `${documentUrl}/fixture-province-plan.html` },
    { ...fixtureNationalPlanSource, link: `${documentUrl}/fixture-national-plan.html` },
  ];

  supabaseServer = createServer((request, response) => {
    const requestUrl = new URL(request.url, supabaseUrl ?? "http://127.0.0.1");
    const table = requestUrl.pathname.split("/").at(-1);

    if (request.method !== "GET" && request.method !== "HEAD") {
      writes.push({ method: request.method, table });
      request.resume();
      response.writeHead(201, { "content-type": "application/json" });
      response.end("{}");
      return;
    }

    if (request.method === "HEAD") {
      response.writeHead(200, { "content-range": "0-0/1" });
      response.end();
      return;
    }

    if (table === "ai_document_contexts") {
      if (requestUrl.searchParams.has("content_fingerprint")) {
        const contentFingerprint = queryValue(
          requestUrl.searchParams,
          "content_fingerprint",
        );
        return sendJson(
          response,
          documentContexts.filter(
            (context) => context.content_fingerprint === contentFingerprint,
          ),
        );
      }

      const sourceType = queryValue(requestUrl.searchParams, "source_type");
      return sendJson(
        response,
        documentContexts.filter((context) => context.source_type === sourceType),
      );
    }

    if (table === "ai_stage_cache") {
      const stage = queryValue(requestUrl.searchParams, "stage_name");
      return sendJson(response, stage ? [buildDocumentCacheRow(stage)] : []);
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
    supabaseServer.once("error", reject);
    supabaseServer.listen(0, "127.0.0.1", resolve);
  });

  supabaseUrl = `http://127.0.0.1:${supabaseServer.address().port}`;
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "ai-document-refresh-fixture-key";
  process.env.AI_PROMPT_VERSION = "fixture-prompt-v7";
  process.env.AI_INVALIDATION_VERSION = "fixture-invalidation-v1";
  process.env.OPENAI_MODEL = "fixture-model";

  ({ getProvincePlanContext, getNationalPlanContext } = await import(
    "../src/lib/ai/documents.ts"
  ));
  ({ runAiStage } = await import("../src/lib/ai/pipeline.ts"));
});

after(async () => {
  await Promise.all([
    new Promise((resolve) => documentServer.close(resolve)),
    new Promise((resolve) => supabaseServer.close(resolve)),
  ]);
});

beforeEach(() => {
  documentRevision = "stored";
  documentFetchUrls = [];
  writes = [];
  documentContexts = [
    {
      ...oldProvinceContext,
      source_url_or_path: sourceRows[0].link,
    },
    oldNationalContext,
  ];
});

const validPayload = {
  countryCode: "ZMB",
  releaseKey: fixtureRelease.release_key,
  year: fixtureRelease.year,
  municipalityId: fixtureMunicipality.id,
  scoreId: "prosperity_score",
};

test("normal province document reuse stays download-free", async () => {
  documentRevision = "revised";

  const result = await getProvincePlanContext(
    "ZMB",
    "Chadiza",
    "local/SNG plan unit",
  );

  assert.equal(result.context.extractedText, oldProvinceContext.extracted_text);
  assert.deepEqual(documentFetchUrls, []);
  assert.deepEqual(writes, []);
});

test("province force refresh fetches the selected URL before content reuse", async () => {
  documentRevision = "revised";

  const result = await getProvincePlanContext(
    "ZMB",
    "Chadiza",
    "local/SNG plan unit",
    { forceRefresh: true },
  );

  assert.match(result.context.extractedText, /revised document revision/);
  assert.deepEqual(documentFetchUrls, ["/fixture-province-plan.html"]);
  assert.deepEqual(writes.map(({ table }) => table), ["ai_document_contexts"]);
});

test("force refresh reuses an existing context after fetching unchanged content", async () => {
  documentRevision = "stored";

  const result = await getProvincePlanContext(
    "ZMB",
    "Chadiza",
    "local/SNG plan unit",
    { forceRefresh: true },
  );

  assert.equal(result.context.extractedText, oldProvinceContext.extracted_text);
  assert.deepEqual(documentFetchUrls, ["/fixture-province-plan.html"]);
  assert.deepEqual(writes, []);
});

test("national force refresh fetches the selected URL before content reuse", async () => {
  documentRevision = "revised";

  const result = await getNationalPlanContext("ZMB", "prosperity_score", {
    forceRefresh: true,
  });

  assert.match(result.context.extractedText, /revised document revision/);
  assert.deepEqual(documentFetchUrls, ["/fixture-national-plan.html"]);
  assert.deepEqual(writes.map(({ table }) => table), ["ai_document_contexts"]);
});

test("load_cached province stage does not download or persist", async () => {
  documentRevision = "revised";

  const response = await runAiStage("province_plan_context", {
    ...validPayload,
    mode: "load_cached",
  });

  assert.equal(response.status, "completed", response.errorMessage ?? JSON.stringify(response));
  assert.deepEqual(documentFetchUrls, []);
  assert.deepEqual(writes, []);
});

test("province regeneration refreshes the document through the stage boundary", async () => {
  documentRevision = "revised";

  const response = await runAiStage("province_plan_context", {
    ...validPayload,
    mode: "regenerate",
  });

  assert.equal(response.status, "completed", response.errorMessage ?? JSON.stringify(response));
  assert.match(response.structuredOutput.extractedText, /revised document revision/);
  assert.deepEqual(documentFetchUrls, ["/fixture-province-plan.html"]);
  assert.ok(writes.some(({ table }) => table === "ai_document_contexts"));
  assert.ok(writes.some(({ table }) => table === "ai_stage_runs"));
  assert.ok(writes.some(({ table }) => table === "ai_stage_cache"));
});
