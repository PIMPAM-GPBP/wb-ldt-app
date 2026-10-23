import assert from "node:assert/strict";
import test from "node:test";

import { buildComparisonCsv, buildCsv } from "../src/lib/csv.ts";

test("comparison CSV omits absent administrative tiers and disambiguates equal axes", () => {
  const csv = buildComparisonCsv({
    lowerLabel: "District",
    middleLabel: null,
    higherLabel: "Province",
    xLabel: "Infrastructure",
    yLabel: "Infrastructure",
    points: [
      {
        id: "zmb-1",
        label: "Lufwanyama",
        district: "Unused middle tier",
        province: "Copperbelt",
        x: 42,
        y: 42,
        selected: true,
      },
    ],
  });

  assert.equal(
    csv,
    [
      "id,District,Province,X: Infrastructure,Y: Infrastructure,selected",
      "zmb-1,Lufwanyama,Copperbelt,42,42,true",
    ].join("\n"),
  );
});

test("comparison CSV keeps the middle tier and distinct axis labels when present", () => {
  const csv = buildComparisonCsv({
    lowerLabel: "Municipality",
    middleLabel: "District",
    higherLabel: "Province",
    xLabel: "Infrastructure",
    yLabel: "Prosperity",
    points: [
      {
        id: "npl-1",
        label: "Kathmandu",
        district: "Kathmandu",
        province: "Bagmati",
        x: 61.5,
        y: 73.25,
        selected: false,
      },
    ],
  });

  assert.equal(
    csv,
    [
      "id,Municipality,District,Province,Infrastructure,Prosperity,selected",
      "npl-1,Kathmandu,Kathmandu,Bagmati,61.5,73.25,false",
    ].join("\n"),
  );
});

test("CSV serializer escapes special characters in headers and values", () => {
  const csv = buildCsv(
    ["name", "notes, \"quoted\""],
    [["A, \"quoted\"", "line one\nline two\r\nline three"]],
  );

  assert.equal(
    csv,
    [
      'name,"notes, ""quoted"""',
      '"A, ""quoted""","line one\nline two\r\nline three"',
    ].join("\n"),
  );
});
