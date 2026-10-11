import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReleaseMunicipalityMembership,
  filterMunicipalitiesByReleaseMembership,
} from "../src/lib/data/release-membership.ts";

const root = process.cwd();

function runGeometryScenario(scenario) {
  const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ldt-geometry-test-"));
  const generatedPath = "src/generated/analytics-data.json";
  const mapPath = "public/data/nepal-municipalities.geojson";

  try {
    const fallback = JSON.parse(
      fs.readFileSync(path.join(root, generatedPath), "utf8"),
    );
    const canonical = fallback.municipalities.find((row) => row.year === 2025);
    assert.ok(canonical);
    const maps = JSON.parse(fs.readFileSync(path.join(root, mapPath), "utf8"));
    const canonicalFeature = maps.features.find(
      (row) => row.properties.compositeKey === canonical.compositeKey,
    );
    assert.ok(canonicalFeature);
    const features =
      scenario === "null-canonical-geometry"
        ? [{ ...canonicalFeature, geometry: null }]
        : scenario === "mixed-duplicate-canonical-geometry"
          ? [canonicalFeature, { ...canonicalFeature, geometry: null }]
        : [];

    fs.mkdirSync(path.dirname(path.join(fixtureDirectory, generatedPath)), {
      recursive: true,
    });
    fs.mkdirSync(path.dirname(path.join(fixtureDirectory, mapPath)), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(root, generatedPath),
      path.join(fixtureDirectory, generatedPath),
    );
    fs.writeFileSync(
      path.join(fixtureDirectory, mapPath),
      JSON.stringify({ type: "FeatureCollection", features }),
    );

    const script = `
const Module = require("node:module");
const path = require("node:path");
const root = ${JSON.stringify(root)};
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
    const result = typescript.transpileModule(require("node:fs").readFileSync(filename, "utf8"), {
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
const canonical = ${JSON.stringify(canonical)};
const municipality = {
  id: "canonical-id",
  country_code: "NPL",
  municipality: canonical.municipality,
  district: canonical.district,
  province: canonical.province,
  municipality_slug: canonical.slug.municipality,
  district_slug: canonical.slug.district,
  province_slug: canonical.slug.province,
  composite_key: canonical.compositeKey,
};
const scoreDefinitions = ["infrastructure", "livability", "prosperity"].map((pillar, index) => ({
  id: pillar + "_score",
  canonical_name: pillar + " score",
  pillar,
  description: null,
  component_score_keys: [],
  display_order: index,
}));
const tables = {
  dataset_releases: [{
    id: "release",
    country_code: "NPL",
    release_key: "npl-2025-v1",
    year: 2025,
    label: "Nepal 2025",
    is_active: true,
    created_at: "2026-10-11T00:00:00Z",
  }],
  municipalities: [municipality],
  score_definitions: scoreDefinitions,
  indicators: [],
  score_components: [],
  municipality_score_values: scoreDefinitions.map((row) => ({
    municipality_id: municipality.id,
    score_id: row.id,
    score_value: 40,
  })),
};
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://geometry-fixture.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "geometry-fixture-key";
globalThis.fetch = async (input) => {
  const table = new URL(typeof input === "string" ? input : input.url).pathname.split("/").at(-1);
  if (table === "municipality_boundaries") {
    return new Response(null, { status: 200, headers: { "content-range": "0-0/3" } });
  }
  if (table === "municipality_score_component_values" || table === "municipality_context_values") {
    return new Response(JSON.stringify({ code: "PGRST205", message: "Absent fixture relation" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify(tables[table] ?? []), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
(async () => {
  const { getAnalyticsPageData } = request(path.join(root, "src/lib/data/queries.ts"));
  const data = await getAnalyticsPageData(
    { tab: "single", year: "2025", metric: "infrastructure_score" },
    "NPL",
  );
  process.stdout.write(JSON.stringify({
    coverage: data.coverage,
    renderedFeatures: data.map.features.length,
    nullGeometryFeatures: data.map.features.filter((row) => !row.geometry).length,
    coverageLabel: data.map.coverageLabel,
    recordMapAvailable: data.municipality.mapAvailable,
  }) + "\\n");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

    return JSON.parse(
      execFileSync(process.execPath, ["-e", script], {
        cwd: fixtureDirectory,
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: "https://geometry-fixture.supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "geometry-fixture-key",
        },
      }).trim(),
    );
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

for (const scenario of ["null-canonical-geometry", "absent-canonical-geometry"]) {
  test(`${scenario} is excluded from renderable map data consistently`, () => {
    const result = runGeometryScenario(scenario);

    assert.equal(result.renderedFeatures, 0);
    assert.equal(result.nullGeometryFeatures, 0);
    assert.equal(result.coverage.mapMunicipalityCount, 0);
    assert.equal(result.coverage.analyticsOnlyCount, 1);
    assert.equal(result.coverageLabel, "0 mapped of 1 analytics municipalities");
    assert.equal(result.recordMapAvailable, false);
  });
}

test("mixed canonical geometry duplicates emit only valid map features", () => {
  const result = runGeometryScenario("mixed-duplicate-canonical-geometry");

  assert.equal(result.renderedFeatures, 1);
  assert.equal(result.nullGeometryFeatures, 0);
  assert.equal(result.coverage.mapMunicipalityCount, 1);
  assert.equal(result.coverage.analyticsOnlyCount, 0);
  assert.equal(result.coverageLabel, "1 mapped of 1 analytics municipalities");
  assert.equal(result.recordMapAvailable, true);
});

test("release membership follows bundled release identity and selected-year fallback", () => {
  const membership = buildReleaseMunicipalityMembership(
    [
      { year: 2021, compositeKey: "current" },
      { year: 2025, compositeKey: "current" },
    ],
    2025,
    {
      selectedReleaseKey: "npl-2025-v1",
      bundledReleaseKey: "npl-2025-v1",
    },
  );
  const rows = [
    { composite_key: "current", id: "current-id" },
    { composite_key: "stale", id: "stale-id" },
  ];

  assert.deepEqual(filterMunicipalitiesByReleaseMembership(rows, membership), [rows[0]]);

  const newerRevision = buildReleaseMunicipalityMembership(
    [{ year: 2025, compositeKey: "current" }],
    2025,
    {
      selectedReleaseKey: "npl-2025-v2",
      bundledReleaseKey: "npl-2025-v1",
    },
  );

  assert.deepEqual(filterMunicipalitiesByReleaseMembership(rows, newerRevision), rows);
  assert.ok(newerRevision.byCompositeKey.has("current"));

  const unknownRelease = buildReleaseMunicipalityMembership(
    [{ year: 2025, compositeKey: "current" }],
    2030,
    {
      selectedReleaseKey: "npl-2030-v1",
      bundledReleaseKey: "npl-2025-v1",
    },
  );

  assert.deepEqual(filterMunicipalitiesByReleaseMembership(rows, unknownRelease), rows);
  assert.equal(unknownRelease.byCompositeKey.size, 0);
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

function createSupabaseFixture({ releases, municipalities, scoreValues, boundaryCount }) {
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
        headers: { "content-range": `0-0/${boundaryCount ?? municipalities.length}` },
      });
    }

    if (table === "municipality_score_component_values" || table === "municipality_context_values") {
      return jsonResponse({ code: "PGRST205", message: `Missing relation: ${table}` }, 404);
    }

    return jsonResponse(tables[table] ?? []);
  };

  return { fetchFixture, requests };
}

function createReleaseBoundaryFixture({ releaseKey, extraProvince, boundaryCount }) {
  const fallback = JSON.parse(
    fs.readFileSync(path.join(root, "src/generated/analytics-data.json"), "utf8"),
  );
  const canonical = fallback.municipalities.find((row) => row.year === 2025);
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
      id: "extra-id",
      country_code: "NPL",
      municipality: "New valid municipality",
      district: canonical.district,
      province: extraProvince ?? canonical.province,
      municipality_slug: "new-valid-municipality",
      district_slug: canonical.slug.district,
      province_slug: (extraProvince ?? canonical.province).toLowerCase().replaceAll(" ", "-"),
      composite_key: `${extraProvince ?? canonical.province}::${canonical.district}::New valid municipality`,
    },
  ];
  const releases = [
    {
      id: "selected-release",
      country_code: "NPL",
      release_key: releaseKey,
      year: 2025,
      label: "Nepal LDT 2025",
      admin_file_name: null,
      score_file_name: null,
      geojson_file_name: null,
      is_active: true,
      created_at: "2026-10-11T00:00:00Z",
    },
  ];
  const scoreValues = municipalities.flatMap((municipality, index) =>
    ["infrastructure_score", "livability_score", "prosperity_score"].map((scoreId) => ({
      municipality_id: municipality.id,
      score_id: scoreId,
      score_value: index === 0 ? 40 : 80,
    })),
  );

  return {
    fixture: createSupabaseFixture({ releases, municipalities, scoreValues, boundaryCount }),
    municipalities,
  };
}

async function runAnalyticsFixture({ releaseKey, extraProvince, boundaryCount, searchParams }) {
  const { fixture, municipalities } = createReleaseBoundaryFixture({
    releaseKey,
    extraProvince,
    boundaryCount,
  });
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const request = installTypescriptRequire();

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  globalThis.fetch = fixture.fetchFixture;

  try {
    const { getAnalyticsPageData } = request(path.join(root, "src/lib/data/queries.ts"));
    return {
      data: await getAnalyticsPageData(searchParams, "NPL"),
      municipalities,
    };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
}

test("same-year revised releases retain valid database municipalities", async () => {
  const { data, municipalities } = await runAnalyticsFixture({
    releaseKey: "npl-2025-v2",
    searchParams: {
      tab: "multi",
      year: "2025",
      municipality: "extra-id",
    },
  });

  assert.equal(data.coverage.analyticsMunicipalityCount, municipalities.length);
  assert.equal(data.nationalAverages.scores.infrastructure_score, 60);
  assert.equal(data.selected.municipalityId, "extra-id");
  assert.equal(data.municipality.id, "extra-id");
});

test("coverage counts selected-release geometries instead of stale boundary rows", async () => {
  const { data } = await runAnalyticsFixture({
    releaseKey: "npl-2025-v2",
    boundaryCount: 3,
    searchParams: {
      tab: "single",
      year: "2025",
      municipality: "extra-id",
    },
  });

  assert.equal(data.map.features.length, 1);
  assert.equal(data.coverage.analyticsMunicipalityCount, 2);
  assert.equal(data.coverage.mapMunicipalityCount, 1);
  assert.equal(data.coverage.analyticsOnlyCount, 1);
  assert.ok(data.coverage.analyticsOnlyCount >= 0);
  assert.equal(data.coverage.boundaryOnlyCount, 20);
  assert.equal(data.map.coverageLabel, "1 mapped of 2 analytics municipalities");
});

test("province filters use only municipalities retained for the selected release", async () => {
  const { data } = await runAnalyticsFixture({
    releaseKey: "npl-2025-v1",
    extraProvince: "Obsolete province",
    searchParams: {
      tab: "multi",
      year: "2025",
      province: "Obsolete province",
    },
  });

  assert.deepEqual(data.filters.provinces, ["all", "Sudur Paschim"]);
  assert.equal(data.selected.province, "all");
  assert.equal(data.filters.municipalities.length, 1);
  assert.equal(data.selected.municipalityId, "canonical-id");
  assert.deepEqual(data.scatter2d.points.map((point) => point.id), ["canonical-id"]);
});

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
