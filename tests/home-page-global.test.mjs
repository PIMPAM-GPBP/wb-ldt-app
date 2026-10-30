import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildOutlineMap, simplifyRing } from "../src/lib/maps/outline.ts";

// Failure modes:
// 1. The headline count is typed in by hand and drifts from the loaded releases.
// 2. The page imports a country's generated analytics file itself and ships it to every visitor.
// 3. A country's boundary file draws an empty or inverted map (reversed ring winding broke d3's spherical paths).
// 4. Simplification drops a ring's ends, so outlines no longer close where they started.

test("home page derives the local government count from release metadata", async () => {
  const source = await readFile("src/app/page.tsx", "utf8");

  assert.match(source, /getGlobalReleaseSummary/);
  assert.match(source, /totalLoadedLocalUnits/);
  assert.doesNotMatch(source, /@\/generated\/analytics-data\.json/);
  assert.doesNotMatch(source, /@\/generated\/zambia\/analytics-data\.json/);
  assert.doesNotMatch(source, /@\/generated\/serbia\/analytics-data\.json/);
  assert.doesNotMatch(source, /Nepal LSGs currently loaded/);
});

test("every country's boundaries draw a map that fills its box, one path per unit", async () => {
  for (const [file, units] of [
    ["public/data/nepal-municipalities.geojson", 751],
    ["public/data/serbia/municipalities.geojson", 161],
    ["public/data/zambia/municipalities.geojson", 116],
  ]) {
    const map = buildOutlineMap(JSON.parse(await readFile(file, "utf8")), 420, 320, 1);
    assert.equal(map.units.length, units, file);
    assert.ok(map.width === 420 || map.height === 320, `${file} fits its box`);
    for (const unit of map.units) assert.match(unit.d, /^M\d+,\d+l.*z/, `${file} ${unit.compositeKey}`);
  }
});

test("simplification keeps a ring's first and last points and drops the ones on a straight line", () => {
  const ring = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const kept = simplifyRing(ring, 0.5);
  assert.deepEqual(kept[0], [0, 0]);
  assert.deepEqual(kept.at(-1), [0, 0]);
  assert.ok(!kept.some(([x, y]) => x === 5 && y === 0));
});
