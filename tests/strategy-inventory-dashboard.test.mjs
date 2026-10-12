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
const { ThemeProvider } = request(
  path.join(root, "src/components/theme/theme-provider.tsx"),
);
const { StrategyInventoryDashboard } = request(
  path.join(root, "src/components/strategy-inventory/strategy-inventory-dashboard.tsx"),
);

test("Zambia fallback SSR names Zambia in its missing-unit disclosure", () => {
  const dataset = JSON.parse(
    fs.readFileSync("public/data/zambia/strategy_inventory.sample.json", "utf8"),
  );
  const html = renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(StrategyInventoryDashboard, { dataset }),
    ),
  );

  assert.match(html, /116 expected Zambia LSGs are not represented/);
  assert.doesNotMatch(html, /expected Serbian LSGs/);
});
