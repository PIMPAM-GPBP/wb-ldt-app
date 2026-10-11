import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";

import {
  buildReleaseMunicipalityMembership,
  filterMunicipalitiesByReleaseMembership,
} from "../src/lib/data/release-membership.ts";

const root = process.cwd();

test("known release membership removes stale database units but unknown releases retain them", () => {
  const membership = buildReleaseMunicipalityMembership(
    [
      { year: 2021, compositeKey: "current" },
      { year: 2025, compositeKey: "current" },
    ],
    2025,
  );
  const rows = [
    { composite_key: "current", id: "current-id" },
    { composite_key: "stale", id: "stale-id" },
  ];

  assert.deepEqual(filterMunicipalitiesByReleaseMembership(rows, membership), [rows[0]]);

  const unknownRelease = buildReleaseMunicipalityMembership(
    [{ year: 2025, compositeKey: "current" }],
    2030,
  );

  assert.deepEqual(filterMunicipalitiesByReleaseMembership(rows, unknownRelease), rows);
});

function installTypescriptRequire() {
  const request = Module.createRequire(path.join(root, "package.json"));
  const typescript = request("typescript");
  const oldResolve = Module._resolveFilename;

  Module._resolveFilename = function resolveFilename(specifier, parent, ...rest) {
    if (specifier === "server-only") {
      specifier = path.join(root, "node_modules/next/dist/compiled/server-only/empty.js");
    }

    if (specifier.startsWith("@/")) {
      specifier = path.join(root, "src", specifier.slice(2));
    }

    return oldResolve.call(this, specifier, parent, ...rest);
  };

  for (const extension of [".ts", ".tsx"]) {
    Module._extensions[extension] = (module, filename) => {
      const result = typescript.transpileModule(fs.readFileSync(filename, "utf8"), {
        fileName: filename,
        compilerOptions: {
          target: typescript.ScriptTarget.ES2022,
          module: typescript.ModuleKind.CommonJS,
          jsx: typescript.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      });
      module._compile(result.outputText, filename);
    };
  }

  return request;
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function createSupabaseFixture({ releases, municipalities, scoreValues }) {
  const requests = [];
  const tables = {
    dataset_releases: releases,
    municipalities,
    score_definitions: [
      {
        id: "infrastructure_score",
        canonical_name: "Infrastructure Score",
        pillar: "infrastructure",
        description: null,
        component_score_keys: [
          "broadband_internet_score",
          "mobile_internet_score",
          "key_structure_internet_access_score",
          "accessibility_to_hospitals_score",
          "accessibility_to_schools_score",
        ],
        display_order: 0,
      },
      {
        id: "livability_score",
        canonical_name: "Livability Score",
        pillar: "livability",
        description: null,
        component_score_keys: [],
        display_order: 1,
      },
      {
        id: "prosperity_score",
        canonical_name: "Prosperity Score",
        pillar: "prosperity",
        description: null,
        component_score_keys: [],
        display_order: 2,
      },
    ],
    indicators: [],
    score_components: [],
    municipality_score_values: scoreValues,
  };

  const fetchFixture = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const table = url.pathname.split("/").at(-1);
    requests.push({ table, method: init.method ?? "GET" });

    if (table === "municipality_boundaries") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `0-0/${municipalities.length}` },
      });
    }

    if (table === "municipality_score_component_values" || table === "municipality_context_values") {
      return jsonResponse({ code: "PGRST205", message: `Missing relation: ${table}` }, 404);
    }

    return jsonResponse(tables[table] ?? []);
  };

  return { fetchFixture, requests };
}

test("analytics query uses selected-year fallback membership and historical fallback values", async () => {
  const fallback = JSON.parse(
    fs.readFileSync(path.join(root, "src/generated/analytics-data.json"), "utf8"),
  );
  const canonical = fallback.municipalities.find(
    (municipality) => municipality.year === 2021,
  );
  assert.ok(canonical);

  const municipalities = [
    {
      id: "canonical-id",
      country_code: "NPL",
      municipality: canonical.municipality,
      district: canonical.district,
      province: canonical.province,
      municipality_slug: canonical.slug.municipality,
      district_slug: canonical.slug.district,
      province_slug: canonical.slug.province,
      composite_key: canonical.compositeKey,
    },
    {
      id: "stale-id",
      country_code: "NPL",
      municipality: canonical.municipality,
      district: "Stale district",
      province: canonical.province,
      municipality_slug: canonical.slug.municipality,
      district_slug: "stale-district",
      province_slug: canonical.slug.province,
      composite_key: `${canonical.province}::Stale district::${canonical.municipality}`,
    },
  ];
  const releases = [
    {
      id: "release-2021",
      country_code: "NPL",
      release_key: "npl-2021-v1",
      year: 2021,
      label: "Nepal LDT 2021",
      admin_file_name: null,
      score_file_name: null,
      geojson_file_name: null,
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "release-2025",
      country_code: "NPL",
      release_key: "npl-2025-v1",
      year: 2025,
      label: "Nepal LDT 2025",
      admin_file_name: null,
      score_file_name: null,
      geojson_file_name: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const scoreValues = [
    { municipality_id: "canonical-id", score_id: "infrastructure_score", score_value: 41 },
    { municipality_id: "canonical-id", score_id: "livability_score", score_value: 51.75 },
    { municipality_id: "canonical-id", score_id: "prosperity_score", score_value: 49.8 },
    { municipality_id: "stale-id", score_id: "infrastructure_score", score_value: 100 },
    { municipality_id: "stale-id", score_id: "livability_score", score_value: 100 },
    { municipality_id: "stale-id", score_id: "prosperity_score", score_value: 100 },
  ];
  const fixture = createSupabaseFixture({ releases, municipalities, scoreValues });
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const request = installTypescriptRequire();

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  globalThis.fetch = fixture.fetchFixture;

  try {
    const { getAnalyticsPageData } = request(path.join(root, "src/lib/data/queries.ts"));
    const data = await getAnalyticsPageData(
      { tab: "single", year: "2021", metric: "infrastructure_score" },
      "NPL",
    );

    assert.equal(data.coverage.analyticsMunicipalityCount, 1);
    assert.equal(data.nationalAverages.scores.infrastructure_score, 41);
    assert.equal(data.municipality.context.population, 24682.185546875);
    assert.equal(
      data.metadata.scoreDriverRows.find((row) => row.componentId === "mobile_internet_score")
        ?.municipalityValue,
      12,
    );
    assert.ok(
      fixture.requests.some((requestRecord) => requestRecord.table === "municipality_context_values"),
    );
    assert.ok(
      fixture.requests.some(
        (requestRecord) => requestRecord.table === "municipality_score_component_values",
      ),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
