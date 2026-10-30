import type {
  AnalyticsFeature,
  AnalyticsPageData,
  MetricDefinition,
  Pillar,
} from "@/types/analytics";

export type ThemeName = "light" | "dark";

export const PILLARS: ReadonlyArray<{ id: Pillar; scoreId: string; label: string; cssVar: string }> = [
  { id: "prosperity", scoreId: "prosperity_score", label: "Prosperity", cssVar: "var(--pillar-prosperity)" },
  { id: "infrastructure", scoreId: "infrastructure_score", label: "Infrastructure", cssVar: "var(--pillar-infrastructure)" },
  { id: "livability", scoreId: "livability_score", label: "Livability", cssVar: "var(--pillar-livability)" },
];

// Concrete hex values for canvas renderers (MapLibre, Plotly) that cannot read CSS variables.
// They mirror --chart-5, --chart-1, --chart-3 and --chart-4 in globals.css for each theme.
const PILLAR_HEX: Record<ThemeName, Record<Pillar | "none", string>> = {
  light: { prosperity: "#c7923e", infrastructure: "#3675b7", livability: "#2f8f6f", none: "#374291" },
  dark: { prosperity: "#d6a84f", infrastructure: "#8fa8df", livability: "#62c39a", none: "#a8b2d1" },
};

export const NO_DATA_COLOR: Record<ThemeName, string> = { light: "#dfe3ea", dark: "#24323f" };

export function pillarHex(pillar: Pillar | null | undefined, theme: ThemeName) {
  return PILLAR_HEX[theme][pillar ?? "none"];
}

export function formatScore(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}

export function formatDelta(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "n/a";
  const fixed = Math.abs(value).toFixed(digits);
  if (Number(fixed) === 0) return fixed;
  return value > 0 ? `+${fixed}` : `−${fixed}`;
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export type PillarStanding = {
  pillar: Pillar;
  scoreId: string;
  label: string;
  value: number | null;
  national: number | null;
  nationalMedian: number | null;
  provinceMedian: number | null;
  delta: number | null;
  rank: number | null;
  total: number;
  percentile: number | null;
  /** Every municipality's score for this pillar, for distribution strips and beeswarms. */
  distribution: Array<{ id: string; label: string; province: string; value: number; selected: boolean }>;
};

/**
 * The selected municipality's position on each pillar score.
 * Rank 1 is the highest score. Percentile is the share of municipalities scoring below it.
 * Built from scatter3d points, which cover every municipality when no province filter is set.
 */
export function getPillarStandings(data: AnalyticsPageData): PillarStanding[] {
  const axisByPillar: Record<Pillar, "x" | "y" | "z"> = { prosperity: "x", infrastructure: "y", livability: "z" };
  const labelById = new Map(data.filters.scoreMetrics.map((metric) => [metric.id, metric.label]));

  return PILLARS.map((pillar) => {
    const axis = axisByPillar[pillar.id];
    const distribution = data.scatter3d.points.flatMap((point) => {
      const value = point[axis];
      return value === null ? [] : [{ id: point.id, label: point.label, province: point.province, value, selected: point.selected }];
    });
    const value = data.municipality.scores[pillar.scoreId] ?? null;
    const national = data.nationalAverages.scores[pillar.scoreId] ?? null;
    const values = distribution.map((entry) => entry.value);
    const provinceValues = distribution
      .filter((entry) => entry.province === data.municipality.province)
      .map((entry) => entry.value);
    const rank = value === null ? null : values.filter((other) => other > value).length + 1;
    const percentile =
      value === null || values.length === 0
        ? null
        : Math.round((values.filter((other) => other < value).length / values.length) * 100);

    return {
      pillar: pillar.id,
      scoreId: pillar.scoreId,
      label: labelById.get(pillar.scoreId) ?? pillar.label,
      value,
      national,
      nationalMedian: median(values),
      provinceMedian: median(provinceValues),
      delta: value === null || national === null ? null : value - national,
      rank,
      total: values.length,
      percentile,
      distribution,
    };
  });
}

export type PillarMetricGroup = {
  pillar: Pillar | null;
  label: string;
  score: MetricDefinition | null;
  indicators: MetricDefinition[];
};

/** Metrics as an index tree: each pillar's composite score, then the indicators that feed it. */
export function groupMetricsByPillar(metrics: MetricDefinition[]): PillarMetricGroup[] {
  const groups: PillarMetricGroup[] = PILLARS.map((pillar) => ({
    pillar: pillar.id,
    label: pillar.label,
    score: metrics.find((metric) => metric.kind === "score" && metric.pillar === pillar.id) ?? null,
    indicators: metrics.filter((metric) => metric.kind === "indicator" && metric.pillar === pillar.id),
  }));
  const ungrouped = metrics.filter(
    (metric) => !metric.pillar || !PILLARS.some((pillar) => pillar.id === metric.pillar),
  );
  if (ungrouped.length > 0) {
    groups.push({ pillar: null, label: "Other", score: null, indicators: ungrouped });
  }
  return groups;
}

export type MapClass = {
  index: number;
  min: number;
  max: number;
  color: string;
  count: number;
};

export type MapClassification = {
  classes: MapClass[];
  nullCount: number;
  noDataColor: string;
};

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(from: string, to: string, amount: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount);
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, "0")).join("")}`;
}

/** Sequential ramp in the pillar's hue: pale to deep on light, dim to bright on dark. */
export function pillarRamp(pillar: Pillar | null | undefined, theme: ThemeName, steps = 5) {
  const base = pillarHex(pillar, theme);
  const low = theme === "light" ? mix(base, "#ffffff", 0.86) : mix(base, "#021420", 0.72);
  const high = theme === "light" ? mix(base, "#0b1430", 0.38) : mix(base, "#ffffff", 0.2);
  return Array.from({ length: steps }, (_, index) => mix(low, high, steps === 1 ? 1 : index / (steps - 1)));
}

/**
 * Quantile classes over the features' metric values.
 * Ties can merge edges, so a skewed metric may produce fewer than `steps` classes.
 */
export function classifyFeatures(
  features: AnalyticsFeature[],
  pillar: Pillar | null | undefined,
  theme: ThemeName,
  steps = 5,
): MapClassification {
  const values = features
    .map((feature) => feature.metricValue)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);
  const nullCount = features.length - values.length;
  const noDataColor = NO_DATA_COLOR[theme];

  if (values.length === 0) {
    return { classes: [], nullCount, noDataColor };
  }

  const edges = [values[0]];
  for (let step = 1; step < steps; step += 1) {
    const edge = values[Math.min(values.length - 1, Math.floor((step / steps) * values.length))];
    if (edge > edges[edges.length - 1]) edges.push(edge);
  }
  edges.push(values[values.length - 1]);
  if (edges.length === 2 && edges[0] === edges[1]) edges.pop();

  const classCount = Math.max(1, edges.length - 1);
  const ramp = pillarRamp(pillar, theme, classCount);
  const classes: MapClass[] = Array.from({ length: classCount }, (_, index) => ({
    index,
    min: edges[index],
    max: edges[index + 1] ?? edges[index],
    color: ramp[index],
    count: 0,
  }));

  for (const value of values) {
    classes[classIndexFor(value, classes)].count += 1;
  }

  return { classes, nullCount, noDataColor };
}

/** Class index for a value: lower edge exclusive except for the first class. Null for missing values. */
export function classIndexFor(value: number, classes: MapClass[]): number;
export function classIndexFor(value: number | null, classes: MapClass[]): number | null;
export function classIndexFor(value: number | null, classes: MapClass[]) {
  if (value === null || classes.length === 0) return null;
  const index = classes.findIndex((entry) => value <= entry.max);
  return index === -1 ? classes.length - 1 : index;
}

export type RankedFeature = {
  compositeKey: string;
  name: string;
  district: string;
  province: string;
  value: number | null;
  rank: number | null;
};

/** Features ordered by the active metric, highest first, missing values last. */
export function rankFeatures(features: AnalyticsFeature[]): RankedFeature[] {
  const rows = features.map((feature) => ({
    compositeKey: feature.properties.compositeKey,
    name: feature.properties.Municipality,
    district: feature.properties.District,
    province: feature.properties.Province,
    value: feature.metricValue,
  }));
  const ranked = rows
    .filter((row): row is typeof row & { value: number } => row.value !== null)
    .sort((a, b) => b.value - a.value);
  return [
    ...ranked.map((row) => ({ ...row, rank: ranked.filter((other) => other.value > row.value).length + 1 })),
    ...rows.filter((row) => row.value === null).map((row) => ({ ...row, rank: null })),
  ];
}

/**
 * Indicator labels carry their unit in a trailing parenthesis, for example
 * "Road Flood Risk (unit: %)". Split it so buttons and headings can use the short name.
 * Some source labels leave the outer parenthesis unclosed, so balance by counting.
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
