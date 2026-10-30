// Pure ranking and label logic. No `@/` imports, so tests/analytics-ranking.test.mjs can load this file directly.

/**
 * Splits a source label into its name and unit. Labels put the unit in a trailing parenthesis,
 * for example "Road Flood Risk (unit: %)". Some leave the outer parenthesis unclosed, so the unit
 * is balanced by counting.
 */
export function splitUnit(label: string): { name: string; unit: string | null } {
  const open = label.indexOf(" (");
  if (open === -1) return { name: label, unit: null };
  let unit = label.slice(open + 2).replace(/^unit:\s*/i, "");
  const opens = (unit.match(/\(/g) ?? []).length;
  const closes = (unit.match(/\)/g) ?? []).length;
  if (closes > opens && unit.endsWith(")")) unit = unit.slice(0, -1);
  return { name: label.slice(0, open), unit: unit.trim() || null };
}

export type RankableUnit = {
  id: string;
  compositeKey: string;
  name: string;
  district: string;
  province: string;
  value: number | null;
  /** True when the unit has a boundary feature on the map. */
  mapped: boolean;
};

export type RankedUnit = RankableUnit & {
  /** 1 is the highest value. Ties share a rank. Null when the unit has no value. */
  rank: number | null;
  selected: boolean;
};

export type Ranking = {
  /** Units with a value. Units without one are listed but not counted. */
  rankedCount: number;
  rows: RankedUnit[];
};

function hasValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

/**
 * Orders units by value, highest first. Ties share a rank, so 10, 9, 9, 7 ranks 1, 2, 2, 4.
 * Units without a value follow every ranked unit with a null rank. Units with equal values, and
 * units without a value, are ordered by name.
 */
export function rankUnits(units: readonly RankableUnit[], selectedId: string): Ranking {
  const byName = (a: RankableUnit, b: RankableUnit) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

  const valued = units
    .filter((unit): unit is RankableUnit & { value: number } => hasValue(unit.value))
    .sort((a, b) => b.value - a.value || byName(a, b));
  const missing = units.filter((unit) => !hasValue(unit.value)).sort(byName);

  const ranks: number[] = [];
  valued.forEach((unit, index) => {
    const tied = index > 0 && unit.value === valued[index - 1].value;
    ranks.push(tied ? ranks[index - 1] : index + 1);
  });

  const rows = [
    ...valued.map((unit, index) => ({ ...unit, rank: ranks[index] })),
    ...missing.map((unit) => ({ ...unit, rank: null })),
  ];

  return {
    rankedCount: valued.length,
    rows: rows.map((row) => ({ ...row, selected: row.id === selectedId })),
  };
}

/**
 * Splits units into those with a boundary on the map and those without. Counts, ranks, and averages
 * use only the first group: in Nepal's live data the units without one are slivers left by overlaying
 * two boundary sets, each with its own, often extreme, scores. With no boundary keys at all (a country
 * without map data), every unit is kept.
 */
export function splitByBoundary<T extends { compositeKey: string }>(
  units: readonly T[],
  boundaryKeys: ReadonlySet<string>,
): { withBoundary: T[]; withoutBoundary: T[] } {
  if (boundaryKeys.size === 0) return { withBoundary: [...units], withoutBoundary: [] };
  const withBoundary: T[] = [];
  const withoutBoundary: T[] = [];
  for (const unit of units) (boundaryKeys.has(unit.compositeKey) ? withBoundary : withoutBoundary).push(unit);
  return { withBoundary, withoutBoundary };
}

/**
 * Quantile class edges over values sorted ascending. The map legend and the rank bands both use
 * these, so a unit's band always matches its color on the map. Ties can merge edges, so a skewed
 * metric may produce fewer than `steps` classes.
 */
export function quantileEdges(sortedValues: readonly number[], steps = 5): number[] {
  if (sortedValues.length === 0) return [];
  const last = sortedValues.length - 1;
  const edges = [sortedValues[0]];
  for (let step = 1; step < steps; step += 1) {
    const edge = sortedValues[Math.min(last, Math.floor((step / steps) * sortedValues.length))];
    if (edge > edges[edges.length - 1]) edges.push(edge);
  }
  edges.push(sortedValues[last]);
  if (edges.length === 2 && edges[0] === edges[1]) edges.pop();
  return edges;
}

const FIFTHS = ["Bottom fifth", "Fourth fifth", "Middle fifth", "Second fifth", "Top fifth"];

/** Name of a band. `index` 0 is the lowest of `count` classes. */
export function bandLabel(index: number, count: number): string {
  if (count === 5) return FIFTHS[index];
  if (count <= 1) return "One group";
  const fromTop = count - index;
  if (fromTop === 1) return `Top group of ${count}`;
  if (fromTop === count) return `Bottom group of ${count}`;
  return `Group ${fromTop} of ${count} from the top`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 21st, and so on, with thousands separators. */
export function ordinal(value: number): string {
  const lastTwo = value % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value.toLocaleString("en-US")}${suffix}`;
}

/** Class index for a value: lower edge exclusive except for the first class. Null for missing values. */
export function classIndexFor(value: number, classes: ReadonlyArray<{ max: number }>): number;
export function classIndexFor(value: number | null, classes: ReadonlyArray<{ max: number }>): number | null;
export function classIndexFor(value: number | null, classes: ReadonlyArray<{ max: number }>) {
  if (value === null || classes.length === 0) return null;
  const index = classes.findIndex((entry) => value <= entry.max);
  return index === -1 ? classes.length - 1 : index;
}

export type BandScale = ReadonlyArray<{ index: number; min: number; max: number }>;

export type RankBand = {
  /** 0 is the lowest class. */
  index: number;
  count: number;
  label: string;
};

/** The map legend's classes for a list of values, without colors. */
export function bandScale(values: readonly number[], steps = 5): BandScale {
  const edges = quantileEdges([...values].sort((a, b) => a - b), steps);
  if (edges.length === 0) return [];
  return Array.from({ length: Math.max(1, edges.length - 1) }, (_, index) => ({
    index,
    min: edges[index],
    max: edges[index + 1] ?? edges[index],
  }));
}

/** The band a score falls in, by the same rule the legend uses to color it. Null for a missing score. */
export function bandFor(value: number | null, scale: BandScale): RankBand | null {
  const index = classIndexFor(value, scale);
  return index === null ? null : { index, count: scale.length, label: bandLabel(index, scale.length) };
}
