import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { componentStatus } from "../src/lib/brief/availability.ts";
import { buildFactSheets } from "../src/lib/brief/facts.ts";
import { renderSectionOne } from "../src/lib/brief/section-one.ts";
import { verifySentence } from "../src/lib/brief/verify.ts";
import { countries } from "../src/lib/countries.ts";

// Failure modes these tests cover:
// 1. Component contributions do not add up to the pillar's gap, so the drivers misstate it.
// 2. A component with nothing recorded, or one that does not apply, is named as a driver.
// 3. Data arriving reads as change: Bhaktapur's prosperity "rose" 11.2 points when tourism data first appeared.
// 4. A risk reads as "not applicable" in a year whose road and railway lengths were never computed,
//    which produced 51 false Serbian livability changes.
// 5. A band disagrees with the map, which shows Bhaktapur's prosperity in the fourth fifth.
// 6. A fact id or value changes without a version bump, breaking stored citations.
// 7. A templated sentence, which the public sees unreviewed, fails the verifier.

const golden = JSON.parse(readFileSync("src/lib/brief/golden-set.json", "utf8"));
const sheetsByCountry = new Map(
  countries
    .filter((country) => ["NPL", "ZMB", "SRB"].includes(country.code))
    .map((country) => [country.code, buildFactSheets(JSON.parse(readFileSync(country.fallbackDataPath, "utf8")), country)]),
);
const allSheets = [...sheetsByCountry.values()].flat();
const bhaktapur = sheetsByCountry.get("NPL").find((sheet) => sheet.unit.key === "bagmati-bhaktapur-bhaktapur");

test("component contributions add up to the pillar's gap to the national average", () => {
  for (const sheet of allSheets) {
    for (const pillar of sheet.pillars) {
      const gap = sheet.facts[`${pillar.key}.gap.national`].value;
      const total = pillar.components.reduce((sum, component) => sum + sheet.facts[`${pillar.key}.component.${component.key}.contribution.national`].value, 0);
      // Pillar scores carry one decimal, so a mean of eight whole numbers can be 0.05 off.
      assert.ok(Math.abs(gap - total) <= 0.051, `${sheet.id} ${pillar.key}: gap ${gap}, contributions ${total}`);
    }
  }
});

test("only measured components are named as drivers", () => {
  for (const sheet of allSheets) {
    for (const [id, fact] of Object.entries(sheet.facts)) {
      const match = /^([a-z]+)\.driver\./.exec(id);
      if (!match) continue;
      assert.equal(sheet.facts[`${match[1]}.component.${fact.value}.status`].value, "measured", `${sheet.id} ${id}`);
    }
  }
});

test("a score whose data coverage changed is not given a direction", () => {
  // Naively, 34.4 in 2021 to 45.6 in 2025, all of it from tourism data first recorded in 2025.
  assert.equal(bhaktapur.facts["prosperity.score.2021"].value, 34.4);
  assert.equal(bhaktapur.facts["prosperity.change.direction"].value, "not comparable");
  assert.equal(bhaktapur.facts["prosperity.change.points"].value, null);
  assert.equal(bhaktapur.facts["prosperity.change.coverage_changed.1"].value, "tourism");
});

test("a risk is not recorded, not inapplicable, in a year with no computed asset lengths", () => {
  const unit = {
    indicators: { "road-flood-risk": 0 },
    scoreComponents: { road_flood_score: 54 },
    context: { totalRoadLengthKm: 0 },
  };
  assert.equal(componentStatus("road_flood_score", unit, { computedContext: new Set() }), "not recorded");
  assert.equal(componentStatus("road_flood_score", unit, { computedContext: new Set(["totalRoadLengthKm"]) }), "not applicable");
  const withRoads = { ...unit, context: { totalRoadLengthKm: 12 } };
  assert.equal(componentStatus("road_flood_score", withRoads, { computedContext: new Set(["totalRoadLengthKm"]) }), "measured");
});

test("bands match the map legend's band for the same unit", () => {
  assert.equal(bhaktapur.facts["prosperity.band.national"].value, "Fourth fifth");
});

test("fact sheets for the golden set match the checked-in fixtures", () => {
  for (const unit of golden.units) {
    const built = sheetsByCountry.get(unit.country).find((sheet) => sheet.unit.key === unit.unitKey);
    const fixture = JSON.parse(readFileSync(`tests/fixtures/brief/fact-sheets/${unit.country.toLowerCase()}/${unit.unitKey}.json`, "utf8"));
    assert.deepEqual(built, fixture, `${unit.country} ${unit.unitKey} changed; bump FACT_SHEET_VERSION and rerun scripts/build-brief-golden-set.mjs`);
  }
});

test("every templated sentence for every unit passes the verifier", () => {
  for (const sheet of allSheets) {
    for (const pillar of sheet.pillars) {
      for (const sentence of renderSectionOne(sheet, pillar.key)) {
        const { problems } = verifySentence(sheet, sentence);
        assert.deepEqual(problems, [], `${sheet.id} ${pillar.key}: ${sentence.text}`);
      }
    }
  }
});
