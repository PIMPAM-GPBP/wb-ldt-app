import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
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

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function getRange(input) {
  const url = new URL(typeof input === "string" ? input : input.url);
  const from = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  return { from, to: from + limit - 1 };
}

function createUnstablePaginationFixture() {
  const fallback = JSON.parse(
    fs.readFileSync(path.join(root, "src/generated/zambia/analytics-data.json"), "utf8"),
  );
  const latestRows = fallback.municipalities.filter((row) => row.year === 2025);
  const municipalities = latestRows.map((row, index) => ({
    id: `municipality-${String(index).padStart(3, "0")}`,
    country_code: "ZMB",
    municipality: row.municipality,
    district: row.district,
    province: row.province,
    municipality_slug: row.slug.municipality,
    district_slug: row.slug.district,
    province_slug: row.slug.province,
    composite_key: row.compositeKey,
  }));
  const releases = [
    {
      id: "release-2025",
      country_code: "ZMB",
      release_key: "zmb-2025-v1",
      year: 2025,
      label: "Zambia LDT 2025",
      admin_file_name: null,
      score_file_name: null,
      geojson_file_name: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const scoreDefinitions = fallback.scoreDefinitions.map((definition) => ({
    id: definition.id,
    canonical_name: definition.label,
    pillar: definition.pillar,
    description: null,
    component_score_keys: definition.componentIds,
    display_order: definition.sortOrder,
  }));
  const scoreComponents = fallback.scoreDefinitions.flatMap((definition) =>
    definition.componentIds.map((componentId, index) => ({
      id: componentId,
      canonical_name: definition.componentLabels[index] ?? componentId,
      pillar: definition.pillar,
      parent_score_id: definition.id,
      display_order: index,
    })),
  );
  const scoreValues = municipalities.flatMap((municipality, index) =>
    scoreDefinitions.map((definition) => ({
      municipality_id: municipality.id,
      score_id: definition.id,
      score_value: index + definition.display_order,
    })),
  );
  const componentRows = municipalities.flatMap((municipality, municipalityIndex) =>
    scoreComponents.map((component) => ({
      municipality_id: municipality.id,
      component_id: component.id,
      score_value:
        component.id === "luminosity_per_capita_score" ? municipalityIndex : 50,
    })),
  );
  const contextValues = municipalities.map((municipality) => ({
    municipality_id: municipality.id,
    population: 1000,
    total_land_area_km2: 10,
    total_road_length_km: 2,
    total_railway_length_km: 0,
    road_flood_risk_km: 0,
    road_heatwave_risk_km: 0,
    railway_flood_risk_km: 0,
    railway_heatwave_risk_km: 0,
  }));
  const orderedComponentRows = [...componentRows].sort(
    (left, right) =>
      left.municipality_id.localeCompare(right.municipality_id) ||
      left.component_id.localeCompare(right.component_id),
  );
  let unorderedRequestCount = 0;
  const fetchFixture = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const table = url.pathname.split("/").at(-1);
    const { from, to } = getRange(input);
    const requestedOrder = url.searchParams.get("order") ?? "";

    if (table === "municipality_boundaries") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `0-0/${municipalities.length}` },
      });
    }

    if (table === "plan_document_sources") {
      return jsonResponse([]);
    }

    if (table === "municipality_score_component_values") {
      let rows = orderedComponentRows;

      if (!requestedOrder.includes("municipality_id.asc") || !requestedOrder.includes("component_id.asc")) {
        unorderedRequestCount += 1;
        rows =
          unorderedRequestCount % 2 === 1
            ? orderedComponentRows
                .slice(0, 1000)
                .concat(orderedComponentRows.slice(506, 1000))
                .concat(orderedComponentRows.slice(1494))
            : orderedComponentRows
                .slice(0, 1000)
                .concat(orderedComponentRows.slice(1000, 1494))
                .concat(orderedComponentRows.slice(494, 1088));
      }

      return jsonResponse(rows.slice(from, to + 1));
    }

    const rowsByTable = {
      dataset_releases: releases,
      municipalities,
      score_definitions: scoreDefinitions,
      indicators: [],
      score_components: scoreComponents,
      municipality_score_values: scoreValues,
      municipality_context_values: contextValues,
    };

    return jsonResponse(rowsByTable[table] ?? []);
  };

  return {
    fetchFixture,
    municipalities,
    unorderedRequestCount: () => unorderedRequestCount,
  };
}

test("AI context remains stable when paginated component pages are unordered externally", async () => {
  const fixture = createUnstablePaginationFixture();
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  globalThis.fetch = fixture.fetchFixture;

  try {
    const { getAiPipelineContextForRequest } = request(
      path.join(root, "src/lib/data/queries.ts"),
    );
    const first = await getAiPipelineContextForRequest({
      countryCode: "ZMB",
      year: 2025,
      municipalityId: fixture.municipalities[0].id,
      scoreId: "prosperity_score",
    });
    const second = await getAiPipelineContextForRequest({
      countryCode: "ZMB",
      year: 2025,
      municipalityId: fixture.municipalities[0].id,
      scoreId: "prosperity_score",
    });
    const firstSeries = first.indicatorSeries.find(
      (series) => series.componentId === "luminosity_per_capita_score",
    );
    const secondSeries = second.indicatorSeries.find(
      (series) => series.componentId === "luminosity_per_capita_score",
    );

    assert.equal(firstSeries?.points[0]?.nationalAverage, 57.5);
    assert.deepEqual(secondSeries, firstSeries);
    assert.deepEqual(second.indicatorSeries, first.indicatorSeries);
    assert.equal(fixture.unorderedRequestCount(), 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
