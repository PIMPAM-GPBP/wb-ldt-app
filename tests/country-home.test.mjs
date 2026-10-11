import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildCountryHomeModel } from "../src/lib/country-home.ts";
import { getCountryBySlug } from "../src/lib/countries.ts";

const fixtureDataset = {
  release: { year: 2025, key: "fixture-2025-v1" },
  years: [2024, 2025],
  municipalities: [
    {
      year: 2024,
      municipality: "Old District",
      province: "Central",
      context: { population: 10, totalLandAreaKm2: 10 },
    },
    {
      year: 2025,
      municipality: "Alpha",
      province: "Central",
      context: { population: 20, totalLandAreaKm2: 20 },
    },
    {
      year: 2025,
      municipality: "Beta",
      province: "Copperbelt",
      context: { population: 30, totalLandAreaKm2: 30 },
    },
  ],
};

test("country home model uses latest-year rows and configured public totals", () => {
  const zambia = getCountryBySlug("zambia");
  assert.ok(zambia);

  const model = buildCountryHomeModel(zambia, fixtureDataset);

  assert.equal(model.latestYear, 2025);
  assert.equal(model.lowerCount, 2);
  assert.equal(model.higherCount, 2);
  assert.equal(model.populationLabel, "22.5 million");
  assert.equal(model.areaLabel, "763,027.0 sq km");
  assert.deepEqual(
    model.groups.map((group) => [group.name, group.lowerUnits]),
    [
      ["Central", ["Alpha"]],
      ["Copperbelt", ["Beta"]],
    ],
  );
});

test("Serbia country home model reports the loaded release area", () => {
  const serbia = getCountryBySlug("serbia");
  const dataset = JSON.parse(
    fs.readFileSync("src/generated/serbia/analytics-data.json", "utf8"),
  );

  assert.ok(serbia);
  const model = buildCountryHomeModel(serbia, dataset);

  assert.equal(model.areaLabel, "78,229.4 sq km");
});
