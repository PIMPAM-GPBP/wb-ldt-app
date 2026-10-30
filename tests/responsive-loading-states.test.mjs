import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics loading skeleton exposes accessible busy status", async () => {
  const source = await readFile("src/app/[country]/analytics/loading.tsx", "utf8");

  assert.match(source, /aria-busy="true"/);
  assert.match(source, /role="status"/);
  assert.match(source, /Loading analytics workspace/);
  assert.match(source, /sr-only/);
});

test("analytics chart containers use stable mobile dimensions", async () => {
  const scatter = await readFile("src/components/analytics/scatter-2d.tsx", "utf8");
  const scatter3dLoader = await readFile(
    "src/components/analytics/scatter-3d-loader.tsx",
    "utf8",
  );
  const drivers = await readFile(
    "src/components/analytics/atlas/atlas-profile.tsx",
    "utf8",
  );

  assert.match(scatter, /overflow-x-auto/);
  assert.match(scatter, /min-w-\[720px\]/);
  assert.match(scatter3dLoader, /role="status"/);
  assert.match(scatter3dLoader, /min-h-\[420px\]/);
  // The drivers fit a 320px panel: the label column shrinks and wraps, the bar and value columns hold their width.
  assert.match(drivers, /grid-cols-\[minmax\(0,1fr\)_96px_44px\]/);
});
