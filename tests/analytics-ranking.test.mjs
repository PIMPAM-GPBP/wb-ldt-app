import assert from "node:assert/strict";
import test from "node:test";

import {
  bandLabel,
  ordinal,
  quantileEdges,
  rankUnits,
  splitByBoundary,
  splitUnit,
} from "../src/lib/analytics/ranking.ts";

// Failure modes, each with one test below:
// splitUnit: the prefix is not stripped; nested parentheses are cut short; an unclosed outer
// parenthesis loses a character; a bare trailing parenthesis is not read as the unit; a label with no
// parenthesis gets a unit; an empty unit becomes "" instead of null.
// rankUnits: the order is wrong; ties get consecutive ranks; missing values rank above or among
// the ranked units; rankedCount counts missing values; a NaN ranks as a number; more than one row is
// selected or mapped is lost; an empty input throws.
// splitByBoundary: a unit with a boundary is dropped or a unit without one is kept, so ranks and counts
// include slivers; a country with no boundary data loses every unit.
// quantileEdges: spread values don't give five classes, or tied values give an empty class.
// bandLabel: fifths come out in the wrong order; other class counts name the wrong end as top.
// ordinal: 11th to 13th take st, nd, rd; 21st and 101st take th; large numbers lose their separator.

function unit(name, value, overrides = {}) {
  return {
    id: name,
    compositeKey: name,
    name,
    district: "District",
    province: "Province",
    value,
    mapped: true,
    ...overrides,
  };
}

test("splitUnit reads the unit after the unit: prefix", () => {
  assert.deepEqual(splitUnit("Road Flood Risk (unit: %)"), { name: "Road Flood Risk", unit: "%" });
});

test("splitUnit keeps parentheses that belong to the unit", () => {
  assert.deepEqual(splitUnit("Luminosity per Area (unit: nWatts/(cm2 x sr x km2))"), {
    name: "Luminosity per Area",
    unit: "nWatts/(cm2 x sr x km2)",
  });
});

test("splitUnit keeps the whole unit when the outer parenthesis is never closed", () => {
  assert.deepEqual(splitUnit("Nighttime Luminosity (unit: nWatts/(cm2 x sr)"), {
    name: "Nighttime Luminosity",
    unit: "nWatts/(cm2 x sr)",
  });
});

test("splitUnit reads a bare trailing parenthesis as the unit", () => {
  assert.deepEqual(splitUnit("Change in Build Area (%)"), { name: "Change in Build Area", unit: "%" });
});

test("splitUnit returns a null unit when the label has no parenthesis", () => {
  assert.deepEqual(splitUnit("Population"), { name: "Population", unit: null });
});

test("splitUnit returns a null unit for an empty unit", () => {
  assert.deepEqual(splitUnit("Population (unit: )"), { name: "Population", unit: null });
});

test("rankUnits orders the highest value first with ranks 1, 2, 3", () => {
  const { rows } = rankUnits([unit("Alpha", 3), unit("Beta", 9), unit("Gamma", 5)], "none");

  assert.deepEqual(rows.map((row) => [row.name, row.rank]), [
    ["Beta", 1],
    ["Gamma", 2],
    ["Alpha", 3],
  ]);
});

test("rankUnits gives tied values one rank and skips the next, ordering ties by name", () => {
  const { rows } = rankUnits(
    [unit("Ilam", 9), unit("Kathmandu", 10), unit("Bhaktapur", 9), unit("Pokhara", 7)],
    "none",
  );

  assert.deepEqual(rows.map((row) => [row.name, row.rank]), [
    ["Kathmandu", 1],
    ["Bhaktapur", 2],
    ["Ilam", 2],
    ["Pokhara", 4],
  ]);
});

test("rankUnits puts units without a value after every ranked unit, with a null rank", () => {
  const { rows } = rankUnits(
    [unit("Gamma", null), unit("Beta", 4), unit("Alpha", null), unit("Delta", 8)],
    "none",
  );

  assert.deepEqual(rows.map((row) => [row.name, row.rank]), [
    ["Delta", 1],
    ["Beta", 2],
    ["Alpha", null],
    ["Gamma", null],
  ]);
});

test("rankUnits counts only units with a value in rankedCount", () => {
  const { rankedCount } = rankUnits([unit("Alpha", 4), unit("Beta", null), unit("Gamma", 8)], "none");

  assert.equal(rankedCount, 2);
});

test("rankUnits treats a NaN value as missing", () => {
  const { rankedCount, rows } = rankUnits([unit("Alpha", Number.NaN), unit("Beta", 3)], "none");

  assert.equal(rankedCount, 1);
  assert.deepEqual(rows.map((row) => [row.name, row.rank]), [
    ["Beta", 1],
    ["Alpha", null],
  ]);
});

test("rankUnits marks only the selected unit and keeps each unit's mapped flag", () => {
  const { rows } = rankUnits(
    [unit("Alpha", 9, { mapped: true }), unit("Beta", 4, { mapped: false })],
    "Beta",
  );

  assert.deepEqual(rows.filter((row) => row.selected).map((row) => row.name), ["Beta"]);
  assert.deepEqual(rows.map((row) => [row.name, row.mapped]), [
    ["Alpha", true],
    ["Beta", false],
  ]);
});

test("rankUnits returns no rows and a zero count for an empty list", () => {
  assert.deepEqual(rankUnits([], "none"), { rankedCount: 0, rows: [] });
});

test("splitByBoundary keeps units with a boundary and sets the rest aside, in order", () => {
  const units = [{ compositeKey: "a" }, { compositeKey: "sliver" }, { compositeKey: "b" }];
  const { withBoundary, withoutBoundary } = splitByBoundary(units, new Set(["a", "b"]));
  assert.deepEqual(withBoundary.map((u) => u.compositeKey), ["a", "b"]);
  assert.deepEqual(withoutBoundary.map((u) => u.compositeKey), ["sliver"]);
});

test("splitByBoundary keeps every unit when the country has no boundary data", () => {
  const units = [{ compositeKey: "a" }, { compositeKey: "b" }];
  const { withBoundary, withoutBoundary } = splitByBoundary(units, new Set());
  assert.equal(withBoundary.length, 2);
  assert.equal(withoutBoundary.length, 0);
});

test("quantileEdges gives five classes over spread values", () => {
  const values = Array.from({ length: 10 }, (_, index) => index + 1);
  assert.deepEqual(quantileEdges(values), [1, 3, 5, 7, 9, 10]);
});

test("quantileEdges merges edges for tied values instead of leaving a class empty", () => {
  // Eight tied values fill the first four quintile positions, so only two classes remain, each non-empty.
  const edges = quantileEdges([1, 1, 1, 1, 1, 1, 1, 1, 2, 3]);
  assert.deepEqual(edges, [1, 2, 3]);
  assert.deepEqual(quantileEdges([4, 4, 4]), [4]);
});

test("bandLabel names fifths from the bottom up and other counts from the top", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((index) => bandLabel(index, 5)), [
    "Bottom fifth",
    "Fourth fifth",
    "Middle fifth",
    "Second fifth",
    "Top fifth",
  ]);
  assert.equal(bandLabel(3, 4), "Top group of 4");
  assert.equal(bandLabel(0, 4), "Bottom group of 4");
  assert.equal(bandLabel(2, 4), "Group 2 of 4 from the top");
  assert.equal(bandLabel(0, 1), "One group");
});

test("ordinal uses English suffixes, including the teens, with thousands separators", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112, 567, 1001].map(ordinal),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th", "112th", "567th", "1,001st"],
  );
});
