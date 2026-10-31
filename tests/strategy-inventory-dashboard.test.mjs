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

const React = request("react");
const { renderToStaticMarkup } = request("react-dom/server");
const { getCountryBySlug } = request(path.join(root, "src/lib/countries.ts"));
const { StrategyInventoryDashboard } = request(
  path.join(root, "src/components/strategy-inventory/strategy-inventory-dashboard.tsx"),
);

function renderSample(slug) {
  const dataset = JSON.parse(
    fs.readFileSync(`public/data/${slug}/strategy_inventory.sample.json`, "utf8"),
  );
  const html = renderToStaticMarkup(
    React.createElement(StrategyInventoryDashboard, { dataset, country: getCountryBySlug(slug) }),
  );
  return { dataset, html };
}

test("a country with no inventory rows says so instead of showing an empty table", () => {
  const { html } = renderSample("zambia");

  assert.match(html, /The inventory has no rows for Zambia(?:'|&#x27;)s 116 districts yet/);
  assert.doesNotMatch(html, /<table/);
  assert.doesNotMatch(html, /Serbia/);
});

test("expected units with no inventory row are counted and named as left out of the table", () => {
  const { html } = renderSample("serbia");

  assert.match(html, /153 of Serbia(?:'|&#x27;)s 161 municipalities have no row in the inventory yet/);
  assert.match(html, /<table/);
  assert.doesNotMatch(html, /Zambia/);
});

test("no record's notes reach the rendered page", () => {
  const { dataset, html } = renderSample("serbia");

  for (const record of dataset.records) {
    if (record.notes) assert.ok(!html.includes(record.notes), `${record.lsg_name}'s notes are on the page`);
  }
});
