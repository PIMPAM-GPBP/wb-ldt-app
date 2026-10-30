import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createFactSheetBuilder } from "../src/lib/brief/facts.ts";
import { countries } from "../src/lib/countries.ts";

// Failure modes:
// 1. A country page shows a Livability change from 2024 to 2025, when road and railway risks were recorded only for 2025.
// 2. A change is shown although fewer than half the units' data compare, so it mostly reflects data arriving.
// 3. A change is computed over units whose coverage changed, so the count of units it rests on is wrong.

const builders = countries
  .filter((country) => country.analyticsStatus === "live")
  .map((country) => ({ country, builder: createFactSheetBuilder(JSON.parse(readFileSync(country.fallbackDataPath, "utf8")), country) }));

test("Livability never shows a change into 2025, and names the road and railway risks as the reason", () => {
  for (const { country, builder } of builders) {
    const result = builder.countryChange("livability_score");
    assert.equal(result.change, null, country.slug);
    assert.equal(result.comparedUnits, 0, country.slug);
    assert.ok(result.changedComponents.some((label) => /Railway|Road/.test(label)), country.slug);
  }
});

test("a change appears only when at least half the units compare, and never counts more units than exist", () => {
  for (const { country, builder } of builders) {
    for (const scoreId of ["prosperity_score", "infrastructure_score", "livability_score"]) {
      const result = builder.countryChange(scoreId);
      assert.ok(result.comparedUnits <= result.totalUnits, `${country.slug} ${scoreId}`);
      assert.equal(result.change !== null, result.comparedUnits * 2 >= result.totalUnits, `${country.slug} ${scoreId}`);
    }
  }
});
