import type { MapClassification } from "@/lib/analytics/derive";

const MINUS = "−";
const COMPACT_FROM = 10_000;
const MAX_DIGITS = 4;

export type MetricFormatter = {
  /** Short form for class edges, so five labels fit in a legend row. Large values are abbreviated. */
  edge: (value: number) => string;
  /** Full form for one unit's value, with one more digit than the edges. */
  value: (value: number) => string;
};

function smallestGap(sorted: number[]) {
  let gap = Infinity;
  for (let index = 1; index < sorted.length; index += 1) {
    gap = Math.min(gap, sorted[index] - sorted[index - 1]);
  }
  return gap;
}

/**
 * Number formats for one classification, shared by the legend and the map popup so they agree.
 * Edges get the fewest decimals that keep neighbouring edges distinct after rounding, so a 0 to 100
 * percentage reads "45–53" and a 0 to 1 index reads "0.41–0.57". Negatives use a real minus sign.
 */
export function createMetricFormatter(classification: MapClassification): MetricFormatter {
  const edges = [...new Set(classification.classes.flatMap((entry) => [entry.min, entry.max]))].sort((a, b) => a - b);
  const largest = edges.reduce((max, edge) => Math.max(max, Math.abs(edge)), 0);
  const gap = smallestGap(edges);

  let digits = Number.isFinite(gap) ? Math.ceil(-Math.log10(gap)) : 0;
  // Small scales such as a 0 to 10 score keep one decimal even when the gaps are wide.
  if (digits <= 0 && largest < 20) digits = 1;
  digits = Math.min(MAX_DIGITS, Math.max(0, digits));

  const fixed = (decimals: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const large = largest >= COMPACT_FROM;
  const edgeFormat = large ? compact : fixed(digits);
  const valueFormat = fixed(large ? 0 : Math.min(MAX_DIGITS, digits + 1));

  return {
    edge: (value) => edgeFormat.format(value).replace("-", MINUS),
    value: (value) => valueFormat.format(value).replace("-", MINUS),
  };
}
