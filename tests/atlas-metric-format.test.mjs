import assert from "node:assert/strict";
import test from "node:test";

import { createMetricFormatter } from "../src/components/analytics/atlas/format-metric.ts";

// Failure modes, each with one test below:
// - Two neighbouring class edges round to the same text, so the legend shows "0.4-0.4" then "0.4-0.5".
// - A wide-gap percentage keeps decimals nobody needs, or a 0 to 10 score loses its decimal.
// - A negative edge prints a hyphen, which reads as a range dash next to the separator.
// - A population-sized edge prints 7 digits and overflows a five-across legend row.
// - A one-value or empty classification throws or prints NaN.
// - The popup value matches the legend edge exactly and so hides precision.

function classes(...edges) {
  return {
    classes: edges.slice(1).map((max, index) => ({ index, min: edges[index], max, color: "#000000", count: 1 })),
    nullCount: 0,
    noDataColor: "#dfe3ea",
  };
}

test("edges keep enough decimals to stay distinct", () => {
  const { edge } = createMetricFormatter(classes(0.401, 0.432, 0.465, 0.5, 0.55, 0.61));
  const labels = [0.401, 0.432, 0.465, 0.5, 0.55, 0.61].map(edge);
  assert.equal(new Set(labels).size, labels.length, labels.join(" "));
});

test("wide gaps drop decimals on a percentage and keep one on a small score", () => {
  assert.equal(createMetricFormatter(classes(2.4, 20.1, 41.7, 63.2, 80.9, 99.6)).edge(41.7), "42");
  assert.equal(createMetricFormatter(classes(1.2, 3.9, 5.6, 6.8, 8.1, 9.7)).edge(3.9), "3.9");
});

test("negative edges use a minus sign, not a hyphen", () => {
  const { edge, value } = createMetricFormatter(classes(-12.4, -6.2, -1.1, 0.5, 4.8, 15.3));
  assert.equal(edge(-12.4), "−12.4");
  assert.equal(value(-6.25).startsWith("−"), true);
  assert.equal(edge(-12.4).includes("-"), false);
});

test("large edges are abbreviated and values keep every integer digit", () => {
  const { edge, value } = createMetricFormatter(classes(1200, 8400, 15300, 52100, 240000, 1250000));
  assert.equal(edge(1250000), "1.3M");
  assert.equal(edge(8400), "8.4K");
  assert.equal(value(52134.6), "52,135");
});

test("a single class and an empty classification still format", () => {
  const single = createMetricFormatter(classes(5, 5));
  assert.equal(single.edge(5), "5.0");
  const empty = createMetricFormatter({ classes: [], nullCount: 3, noDataColor: "#dfe3ea" });
  assert.equal(empty.edge(0), "0.0");
  assert.equal(empty.value(7.25), "7.25");
});

test("a unit's value shows one more digit than the legend edge", () => {
  const { edge, value } = createMetricFormatter(classes(2.4, 20.1, 41.7, 63.2, 80.9, 99.6));
  assert.equal(edge(52.34), "52");
  assert.equal(value(52.34), "52.3");
});
