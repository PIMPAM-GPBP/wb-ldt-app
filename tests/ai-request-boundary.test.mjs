import "./support/register.mjs";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { after, before } from "node:test";

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

const fixturePlanSource = {
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

let fixtureServer;
let fixtureUrl;
let post;
let getAiPipelineContextForRequest;
let validateAiStageRequestPayload;

function sendJson(response, body, headers = {}) {
  response.writeHead(200, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

before(async () => {
  fixtureServer = createServer((request, response) => {
    assert.ok(request.method === "GET" || request.method === "HEAD");

    const table = new URL(request.url, fixtureUrl ?? "http://127.0.0.1").pathname
      .split("/")
      .at(-1);

    if (request.method === "HEAD") {
      response.writeHead(200, { "content-range": "0-0/1" });
      response.end();
      return;
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
      plan_document_sources: [fixturePlanSource],
      ai_stage_cache: [],
    }[table] ?? [];

    sendJson(response, rows);
  });

  await new Promise((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", resolve);
  });

  fixtureUrl = `http://127.0.0.1:${fixtureServer.address().port}`;
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixtureUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "ai-boundary-test-fixture-key";
  process.env.AI_GENERATION_ENABLED = "true";

  ({ POST: post } = await import(
    "../src/app/api/ai/indicator-narrative/route.ts"
  ));
  ({ getAiPipelineContextForRequest } = await import(
    "../src/lib/data/queries.ts"
  ));
  ({ validateAiStageRequestPayload } = await import(
    "../src/lib/ai/request.ts"
  ));
});

after(async () => {
  await new Promise((resolve) => fixtureServer.close(resolve));
});

const validPayload = {
  countryCode: "ZMB",
  releaseKey: fixtureRelease.release_key,
  year: fixtureRelease.year,
  municipalityId: fixtureMunicipality.id,
  scoreId: "prosperity_score",
  mode: "load_cached",
};

test("the AI route returns a structured 400 for malformed JSON", async () => {
  const response = await post(
    new Request("http://localhost/api/ai/indicator-narrative", {
      method: "POST",
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), {
    error: "Invalid JSON request body.",
  });
});

test("AI payload validation rejects blank scope values and non-integer years", () => {
  for (const invalidPayload of [
    { ...validPayload, releaseKey: "" },
    { ...validPayload, municipalityId: "   " },
    { ...validPayload, scoreId: "" },
    { ...validPayload, year: Number.NaN },
    { ...validPayload, year: 2025.5 },
    { ...validPayload, year: Number.POSITIVE_INFINITY },
  ]) {
    assert.equal(validateAiStageRequestPayload(invalidPayload).ok, false);
  }
});

test("AI context rejects each scope value that would otherwise fall back", async () => {
  const mismatches = [
    ["release key", { releaseKey: "zmb-2024-v1" }],
    ["year", { year: 1999 }],
    ["municipality", { municipalityId: "zmb-eastern-eastern-missing" }],
    ["score", { scoreId: "unsupported_score" }],
  ];

  for (const [label, override] of mismatches) {
    await assert.rejects(
      () =>
        getAiPipelineContextForRequest({
          ...validPayload,
          ...override,
          includeProvincePlanCandidates: false,
        }),
      (error) => {
        assert.equal(error.name, "InvalidAiScopeError", label);
        return true;
      },
    );
  }
});

test("the AI route returns 400 when an explicit release falls back", async () => {
  const response = await post(
    new Request("http://localhost/api/ai/indicator-narrative", {
      method: "POST",
      body: JSON.stringify({ ...validPayload, releaseKey: "zmb-2024-v1" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "AI request scope does not match the selected analytics data.",
  });
});
