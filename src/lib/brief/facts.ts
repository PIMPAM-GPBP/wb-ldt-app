import type { AnalyticsDataset, MunicipalityRecord, Pillar } from "@/types/analytics";

import { bandFor, bandScale, type BandScale } from "../analytics/ranking.ts";
import { componentStatus, yearCoverage, type ComponentStatus, type YearCoverage } from "./availability.ts";

/**
 * The fact sheet: every number a brief may state, computed in code, each under a
 * stable id. Prose cites ids, and the verifier checks each number against them.
 */

/** Bump when an id, a value, or a rule changes, so stored briefs know which sheet they cite. */
export const FACT_SHEET_VERSION = 2;

/** Fifths need enough units to mean anything; Zambia's provinces and Serbia's districts hold 3 to 17. */
const MIN_UNITS_FOR_PROVINCE_BAND = 20;
/** A component is a driver only when it moves the pillar's gap by at least this many points. */
const MIN_DRIVER_CONTRIBUTION = 0.5;
const DRIVERS_PER_DIRECTION = 2;
const NEIGHBOUR_COUNT = 3;
/** Two units are compared only on components measured in both, and need at least this many. */
const MIN_SHARED_COMPONENTS = 2;

export type FactValue = number | string | null;

export type Fact = {
  /** Unique within the sheet, such as "prosperity.component.tourism.value". */
  id: string;
  value: FactValue;
  /** What the value is, in words, for the prompt and for reviewers. */
  label: string;
  /** Decimal places a sentence may show; text may round further. */
  decimals?: number;
  /** A gap, change, or contribution: text gives its size, and a word such as "above" gives its sign. */
  signed?: boolean;
};

export type CountryInfo = {
  code: string;
  name: string;
  adminLabels: {
    lower: { singular: string; plural: string };
    higher: { singular: string; plural: string };
  };
};

export type SheetComponent = { id: string; key: string; label: string };
export type SheetPillar = { key: Pillar; scoreId: string; label: string; components: SheetComponent[] };

export type FactSheet = {
  version: number;
  /** Prefix of every global fact id, such as "npl.2025.bagmati-bhaktapur-bhaktapur". */
  id: string;
  country: {
    code: string;
    name: string;
    unit: { singular: string; plural: string };
    higherUnit: { singular: string; plural: string };
  };
  release: { key: string; year: number; firstYear: number };
  unit: { key: string; compositeKey: string; name: string; district: string; province: string };
  pillars: SheetPillar[];
  facts: Record<string, Fact>;
};

export const globalFactId = (sheet: Pick<FactSheet, "id">, localId: string) => `${sheet.id}.${localId}`;

/** Strips float noise such as 56.99999999999999 without rounding away real precision. */
const clean = (value: number) => Math.round(value * 1e6) / 1e6;

const mean = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: readonly number[]) {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

type Scaler = { mean: number; sd: number };

function scalerFor(values: readonly number[]): Scaler | null {
  const average = mean(values);
  const sd = standardDeviation(values);
  return average === null || !sd ? null : { mean: average, sd };
}

const CONTEXT_DIMENSIONS = ["population", "totalLandAreaKm2"] as const;

type PillarStats = {
  pillar: SheetPillar;
  nationalAverage: number | null;
  provinceAverage: Map<string, number | null>;
  nationalScale: BandScale;
  provinceScale: Map<string, BandScale | null>;
  stableThreshold: number;
  components: Map<
    string,
    {
      nationalAverage: number | null;
      provinceAverage: Map<string, number | null>;
      recordedUnits: number;
      scaler: Scaler | null;
    }
  >;
  /** Scaled values per unit: measured components only, keyed by component id. */
  vectors: Map<string, Map<string, number>>;
};

type StatusOf = (componentId: string, record: MunicipalityRecord) => ComponentStatus;

type CountryContext = {
  country: CountryInfo;
  statusOf: StatusOf;
  release: FactSheet["release"] & { key: string };
  years: number[];
  history: Map<string, Map<number, MunicipalityRecord>>;
  latest: MunicipalityRecord[];
  pillars: PillarStats[];
  contextVectors: Map<string, Map<string, number>>;
};

function statusSignature(statusOf: StatusOf, pillar: SheetPillar, record: MunicipalityRecord) {
  return pillar.components.map((component) => statusOf(component.id, record)).join("|");
}

function averagesByProvince(units: readonly MunicipalityRecord[], read: (unit: MunicipalityRecord) => number | null | undefined) {
  const groups = new Map<string, number[]>();
  for (const unit of units) {
    const value = read(unit);
    if (!isNumber(value)) continue;
    groups.set(unit.province, [...(groups.get(unit.province) ?? []), value]);
  }
  return new Map([...groups].map(([province, values]) => [province, mean(values)]));
}

function buildCountryContext(dataset: AnalyticsDataset, country: CountryInfo): CountryContext {
  const years = [...dataset.years].sort((a, b) => a - b);
  const year = dataset.release.year;

  const history = new Map<string, Map<number, MunicipalityRecord>>();
  for (const record of dataset.municipalities) {
    const byYear = history.get(record.id) ?? new Map<number, MunicipalityRecord>();
    byYear.set(record.year, record);
    history.set(record.id, byYear);
  }
  const latest = dataset.municipalities
    .filter((record) => record.year === year)
    .sort((a, b) => a.id.localeCompare(b.id));

  const coverageByYear = new Map<number, YearCoverage>(
    years.map((entry) => [entry, yearCoverage(dataset.municipalities.filter((record) => record.year === entry))]),
  );
  const statusOf: StatusOf = (componentId, record) => componentStatus(componentId, record, coverageByYear.get(record.year));

  const provinceSizes = new Map<string, number>();
  for (const unit of latest) provinceSizes.set(unit.province, (provinceSizes.get(unit.province) ?? 0) + 1);

  const contextScalers = new Map(
    CONTEXT_DIMENSIONS.map((dimension) => [
      dimension,
      scalerFor(latest.map((unit) => unit.context[dimension]).filter(isNumber).map(Math.log1p)),
    ]),
  );
  const contextVectors = new Map(
    latest.map((unit) => {
      const vector = new Map<string, number>();
      for (const dimension of CONTEXT_DIMENSIONS) {
        const value = unit.context[dimension];
        const scaler = contextScalers.get(dimension);
        if (isNumber(value) && scaler) vector.set(dimension, (Math.log1p(value) - scaler.mean) / scaler.sd);
      }
      return [unit.id, vector];
    }),
  );

  const pillars = [...dataset.scoreDefinitions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition): PillarStats => {
      const pillar: SheetPillar = {
        key: definition.pillar,
        scoreId: definition.id,
        label: definition.label,
        components: definition.componentIds.map((id, index) => ({
          id,
          key: id.replace(/_score$/, ""),
          label: definition.componentLabels[index] ?? id,
        })),
      };

      const scores = latest.map((unit) => unit.scores[pillar.scoreId]).filter(isNumber);
      const provinceScale = new Map<string, BandScale | null>();
      for (const [province, size] of provinceSizes) {
        const values = latest
          .filter((unit) => unit.province === province)
          .map((unit) => unit.scores[pillar.scoreId])
          .filter(isNumber);
        provinceScale.set(province, size >= MIN_UNITS_FOR_PROVINCE_BAND ? bandScale(values) : null);
      }

      // The usual year-to-year movement, from pairs of years with the same coverage,
      // so a component appearing in the data does not count as movement.
      const movements: number[] = [];
      for (const byYear of history.values()) {
        for (let index = 1; index < years.length; index += 1) {
          const before = byYear.get(years[index - 1]);
          const after = byYear.get(years[index]);
          const from = before?.scores[pillar.scoreId];
          const to = after?.scores[pillar.scoreId];
          if (!before || !after || !isNumber(from) || !isNumber(to)) continue;
          if (statusSignature(statusOf, pillar, before) !== statusSignature(statusOf, pillar, after)) continue;
          movements.push(Math.abs(to - from));
        }
      }

      const components = new Map(
        pillar.components.map((component) => {
          const measured = latest.filter((unit) => statusOf(component.id, unit) === "measured");
          return [
            component.id,
            {
              nationalAverage: mean(latest.map((unit) => unit.scoreComponents[component.id]).filter(isNumber)),
              provinceAverage: averagesByProvince(latest, (unit) => unit.scoreComponents[component.id]),
              recordedUnits: measured.length,
              scaler: scalerFor(measured.map((unit) => unit.scoreComponents[component.id]).filter(isNumber)),
            },
          ];
        }),
      );

      const vectors = new Map(
        latest.map((unit) => {
          const vector = new Map<string, number>();
          for (const component of pillar.components) {
            const value = unit.scoreComponents[component.id];
            const scaler = components.get(component.id)?.scaler;
            if (statusOf(component.id, unit) === "measured" && isNumber(value) && scaler) {
              vector.set(component.id, (value - scaler.mean) / scaler.sd);
            }
          }
          return [unit.id, vector];
        }),
      );

      return {
        pillar,
        nationalAverage: mean(scores),
        provinceAverage: averagesByProvince(latest, (unit) => unit.scores[pillar.scoreId]),
        nationalScale: bandScale(scores),
        provinceScale,
        stableThreshold: median(movements) ?? 0,
        components,
        vectors,
      };
    });

  return {
    country,
    statusOf,
    release: { key: dataset.release.key, year, firstYear: years[0] ?? year },
    years,
    history,
    latest,
    pillars,
    contextVectors,
  };
}

type Neighbour = { unit: MunicipalityRecord; differs: string | null };

function nearestNeighbours(context: CountryContext, stats: PillarStats, unit: MunicipalityRecord): Neighbour[] {
  const mine = stats.vectors.get(unit.id) ?? new Map<string, number>();
  const myContext = context.contextVectors.get(unit.id) ?? new Map<string, number>();

  const candidates: Array<Neighbour & { distance: number }> = [];
  for (const other of context.latest) {
    if (other.id === unit.id) continue;
    const theirs = stats.vectors.get(other.id) ?? new Map<string, number>();
    const shared = [...mine.keys()].filter((id) => theirs.has(id));
    if (shared.length < MIN_SHARED_COMPONENTS) continue;

    const differences = shared.map((id) => ({ id, gap: (mine.get(id) as number) - (theirs.get(id) as number) }));
    const theirContext = context.contextVectors.get(other.id) ?? new Map<string, number>();
    for (const dimension of CONTEXT_DIMENSIONS) {
      if (myContext.has(dimension) && theirContext.has(dimension)) {
        differences.push({ id: dimension, gap: (myContext.get(dimension) as number) - (theirContext.get(dimension) as number) });
      }
    }

    const distance = Math.sqrt(differences.reduce((sum, entry) => sum + entry.gap ** 2, 0) / differences.length);
    const widest = differences
      .filter((entry) => shared.includes(entry.id))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.id.localeCompare(b.id))[0];
    candidates.push({ unit: other, differs: widest && Math.abs(widest.gap) > 0 ? widest.id : null, distance });
  }

  return candidates
    .sort((a, b) => a.distance - b.distance || a.unit.municipality.localeCompare(b.unit.municipality))
    .slice(0, NEIGHBOUR_COUNT);
}

function sheetFor(context: CountryContext, unit: MunicipalityRecord): FactSheet {
  const { country, release, statusOf } = context;
  const code = country.code.toLowerCase();
  const unitKey = unit.id.startsWith(`${code}-`) ? unit.id.slice(code.length + 1) : unit.id;
  const unitPlural = country.adminLabels.lower.plural.toLowerCase();
  const facts: Record<string, Fact> = {};

  const add = (id: string, value: FactValue, label: string, options: Omit<Fact, "id" | "value" | "label"> = {}) => {
    facts[id] = { id, value: typeof value === "number" ? clean(value) : value, label, ...options };
  };
  const byYear = context.history.get(unit.id) ?? new Map<number, MunicipalityRecord>();

  add("release.year", release.year, "Year of the data edition", { decimals: 0 });
  add("release.first_year", release.firstYear, "First year in the data", { decimals: 0 });
  add("country.unit_count", context.latest.length, `Number of ${country.name}'s ${unitPlural} with scores and a boundary`, { decimals: 0 });

  for (const stats of context.pillars) {
    const { pillar } = stats;
    const p = pillar.key;
    const score = unit.scores[pillar.scoreId];
    const provinceAverage = stats.provinceAverage.get(unit.province) ?? null;
    const name = pillar.label;

    add(`${p}.score`, score ?? null, `${name}, ${unit.municipality}, ${release.year}`, { decimals: 1 });
    add(`${p}.national_average`, stats.nationalAverage, `Average ${name} of ${country.name}'s ${unitPlural}, ${release.year}`, { decimals: 1 });
    add(`${p}.province_average`, provinceAverage, `Average ${name} of ${unitPlural} in ${unit.province}, ${release.year}`, { decimals: 1 });
    add(`${p}.gap.national`, isNumber(score) && isNumber(stats.nationalAverage) ? score - stats.nationalAverage : null,
      `${name} minus the national average`, { decimals: 1, signed: true });
    add(`${p}.gap.province`, isNumber(score) && isNumber(provinceAverage) ? score - provinceAverage : null,
      `${name} minus the ${unit.province} average`, { decimals: 1, signed: true });
    add(`${p}.band.national`, bandFor(score ?? null, stats.nationalScale)?.label ?? null,
      `Band of the ${name} among ${country.name}'s ${unitPlural}, from the map legend's classes`);
    const provinceScale = stats.provinceScale.get(unit.province) ?? null;
    add(`${p}.band.province`, provinceScale ? bandFor(score ?? null, provinceScale)?.label ?? null : null,
      `Band of the ${name} among ${unitPlural} in ${unit.province}; empty where the ${country.adminLabels.higher.singular.toLowerCase()} has under ${MIN_UNITS_FOR_PROVINCE_BAND} ${unitPlural}`);

    for (const year of context.years) {
      if (year >= release.year) continue;
      add(`${p}.score.${year}`, byYear.get(year)?.scores[pillar.scoreId] ?? null, `${name}, ${unit.municipality}, ${year}`, { decimals: 1 });
    }

    // Change runs from the earliest year whose coverage matches the latest year's;
    // across a coverage change, the score moves because data arrived, not because the place changed.
    add(`${p}.stable_threshold`, stats.stableThreshold,
      `Median year-to-year movement of the ${name} across ${country.name}, between years with the same data coverage; smaller changes count as broadly stable`,
      { decimals: 1 });
    const latestSignature = statusSignature(statusOf, pillar, unit);
    const baseYear = context.years.find((year) => {
      const record = byYear.get(year);
      return year < release.year && record && isNumber(record.scores[pillar.scoreId]) && statusSignature(statusOf, pillar, record) === latestSignature;
    });
    const baseScore = baseYear === undefined ? null : (byYear.get(baseYear)?.scores[pillar.scoreId] ?? null);
    const change = isNumber(score) && isNumber(baseScore) ? score - baseScore : null;
    const hasEarlierYear = context.years.some((year) => year < release.year && byYear.has(year));
    const direction =
      change === null
        ? hasEarlierYear ? "not comparable" : "no earlier year"
        : Math.abs(clean(change)) <= stats.stableThreshold ? "broadly stable" : change > 0 ? "rose" : "fell";
    add(`${p}.change.base_year`, baseYear ?? null, `First year with the same data coverage as ${release.year}`, { decimals: 0 });
    add(`${p}.change.base_score`, baseScore, `${name} in that year`, { decimals: 1 });
    add(`${p}.change.points`, change, `${name} change since that year`, { decimals: 1, signed: true });
    add(`${p}.change.direction`, direction, `How the ${name} moved since that year`);
    const firstRecord = byYear.get(release.firstYear);
    if (direction === "not comparable" && firstRecord) {
      pillar.components
        .filter((component) => statusOf(component.id, firstRecord) !== statusOf(component.id, unit))
        .forEach((component, index) =>
          add(`${p}.change.coverage_changed.${index + 1}`, component.key, `A component whose data coverage changed after ${release.firstYear}`),
        );
    }

    const statuses = new Map<string, ComponentStatus>(pillar.components.map((component) => [component.id, statusOf(component.id, unit)]));
    const contributors = pillar.components.filter(
      (component) => isNumber(unit.scoreComponents[component.id]) && isNumber(stats.components.get(component.id)?.nationalAverage),
    ).length || 1;

    const contributions: Array<{ component: SheetComponent; national: number | null; province: number | null }> = [];
    for (const component of pillar.components) {
      const value = unit.scoreComponents[component.id];
      const componentStats = stats.components.get(component.id);
      const national = componentStats?.nationalAverage ?? null;
      const province = componentStats?.provinceAverage.get(unit.province) ?? null;
      const base = `${p}.component.${component.key}`;
      const nationalContribution = isNumber(value) && isNumber(national) ? (value - national) / contributors : null;
      const provinceContribution = isNumber(value) && isNumber(province) ? (value - province) / contributors : null;

      add(`${base}.value`, value ?? null, `${component.label}, ${unit.municipality}, ${release.year}`, { decimals: 0 });
      add(`${base}.status`, statuses.get(component.id) ?? "missing", `Whether the ${component.label} rests on a measurement`);
      add(`${base}.national_average`, national, `Average ${component.label} of ${country.name}'s ${unitPlural}`, { decimals: 1 });
      add(`${base}.province_average`, province, `Average ${component.label} of ${unitPlural} in ${unit.province}`, { decimals: 1 });
      add(`${base}.gap.national`, isNumber(value) && isNumber(national) ? value - national : null,
        `${component.label} minus its national average`, { decimals: 1, signed: true });
      add(`${base}.gap.province`, isNumber(value) && isNumber(province) ? value - province : null,
        `${component.label} minus its ${unit.province} average`, { decimals: 1, signed: true });
      add(`${base}.contribution.national`, nationalContribution,
        `Points the ${component.label} adds to or takes from the ${name}'s gap to the national average`, { decimals: 1, signed: true });
      add(`${base}.contribution.province`, provinceContribution,
        `Points the ${component.label} adds to or takes from the ${name}'s gap to the ${unit.province} average`, { decimals: 1, signed: true });
      add(`${base}.recorded_units`, componentStats?.recordedUnits ?? 0,
        `Number of ${country.name}'s ${unitPlural} where the ${component.label} rests on a measurement`, { decimals: 0 });
      for (const year of context.years) {
        if (year >= release.year) continue;
        add(`${base}.value.${year}`, byYear.get(year)?.scoreComponents[component.id] ?? null, `${component.label}, ${unit.municipality}, ${year}`, { decimals: 0 });
      }

      if (statuses.get(component.id) === "measured") {
        contributions.push({ component, national: nationalContribution, province: provinceContribution });
      }
    }

    for (const scope of ["national", "province"] as const) {
      const ranked = contributions.filter((entry) => isNumber(entry[scope]) && Math.abs(entry[scope] as number) >= MIN_DRIVER_CONTRIBUTION);
      const down = ranked.filter((entry) => (entry[scope] as number) < 0).sort((a, b) => (a[scope] as number) - (b[scope] as number) || a.component.key.localeCompare(b.component.key));
      const up = ranked.filter((entry) => (entry[scope] as number) > 0).sort((a, b) => (b[scope] as number) - (a[scope] as number) || a.component.key.localeCompare(b.component.key));
      const against = scope === "national" ? "national" : unit.province;
      down.slice(0, DRIVERS_PER_DIRECTION).forEach((entry, index) =>
        add(`${p}.driver.${scope}.down.${index + 1}`, entry.component.key, `Measured component pulling the ${name} furthest below the ${against} average, number ${index + 1}`));
      up.slice(0, DRIVERS_PER_DIRECTION).forEach((entry, index) =>
        add(`${p}.driver.${scope}.up.${index + 1}`, entry.component.key, `Measured component lifting the ${name} furthest above the ${against} average, number ${index + 1}`));
    }

    const counts = { measured: 0, "not recorded": 0, "not applicable": 0, missing: 0 };
    for (const status of statuses.values()) counts[status] += 1;
    add(`${p}.coverage.components`, pillar.components.length, `Number of components in the ${name}`, { decimals: 0 });
    add(`${p}.coverage.measured`, counts.measured, `Components resting on a measurement for ${release.year}`, { decimals: 0 });
    add(`${p}.coverage.not_recorded`, counts["not recorded"], `Components with nothing recorded for ${release.year}`, { decimals: 0 });
    add(`${p}.coverage.not_applicable`, counts["not applicable"], `Components that do not apply because the asset at risk is absent`, { decimals: 0 });
    add(`${p}.coverage.missing`, counts.missing, `Components with no value at all`, { decimals: 0 });

    nearestNeighbours(context, stats, unit).forEach((neighbour, index) => {
      const base = `${p}.neighbour.${index + 1}`;
      const differs = pillar.components.find((component) => component.id === neighbour.differs) ?? null;
      add(`${base}.name`, neighbour.unit.municipality,
        `${index + 1}${["st", "nd", "rd"][index] ?? "th"} most similar ${country.adminLabels.lower.singular.toLowerCase()} by measured ${name} components, population, and land area (${neighbour.unit.district}, ${neighbour.unit.province})`);
      add(`${base}.score`, neighbour.unit.scores[pillar.scoreId] ?? null, `${name} of ${neighbour.unit.municipality}, ${release.year}`, { decimals: 1 });
      add(`${base}.differs`, differs?.key ?? null, `Component where ${neighbour.unit.municipality} differs most from ${unit.municipality}`);
      add(`${base}.differs_value`, differs ? (neighbour.unit.scoreComponents[differs.id] ?? null) : null,
        `${differs?.label ?? "That component"} of ${neighbour.unit.municipality}, ${release.year}`, { decimals: 0 });
    });
  }

  return {
    version: FACT_SHEET_VERSION,
    id: `${code}.${release.year}.${unitKey}`,
    country: {
      code: country.code,
      name: country.name,
      unit: { singular: country.adminLabels.lower.singular, plural: country.adminLabels.lower.plural },
      higherUnit: { singular: country.adminLabels.higher.singular, plural: country.adminLabels.higher.plural },
    },
    release: { key: release.key, year: release.year, firstYear: release.firstYear },
    unit: { key: unitKey, compositeKey: unit.compositeKey, name: unit.municipality, district: unit.district, province: unit.province },
    pillars: context.pillars.map((stats) => stats.pillar),
    facts,
  };
}

/**
 * Computes the country-wide figures once (averages, bands, the stable threshold, neighbour
 * scaling) and builds one unit's sheet on request, so a server never holds every sheet.
 */
export function createFactSheetBuilder(dataset: AnalyticsDataset, country: CountryInfo) {
  const context = buildCountryContext(dataset, country);
  const byCompositeKey = new Map(context.latest.map((unit) => [unit.compositeKey, unit]));
  const code = country.code.toLowerCase();
  const unitKeyOf = (unit: MunicipalityRecord) => (unit.id.startsWith(`${code}-`) ? unit.id.slice(code.length + 1) : unit.id);
  return {
    release: context.release,
    /** Every unit in the release year, as the review console lists and links them. */
    units() {
      return context.latest.map((unit) => ({ key: unitKeyOf(unit), compositeKey: unit.compositeKey, name: unit.municipality, district: unit.district, province: unit.province }));
    },
    /** Null for a unit with no record in the release year. */
    sheetFor(compositeKey: string): FactSheet | null {
      const unit = byCompositeKey.get(compositeKey);
      return unit ? sheetFor(context, unit) : null;
    },
    all(): FactSheet[] {
      return context.latest.map((unit) => sheetFor(context, unit));
    },
    /** Every unit's score in the release year, over the same units the sheets count. */
    scores(scoreId: string): number[] {
      return context.latest.map((unit) => unit.scores[scoreId]).filter(isNumber);
    },
    /**
     * A pillar's national median, and the median change since the previous year over the units
     * whose data coverage is the same in both years, by the rule the sheets use for one unit.
     * The change is null when fewer than half the units compare, since the rest moved because
     * data arrived; `changedComponents` names the components behind that, most frequent first.
     */
    countryChange(scoreId: string) {
      const stats = context.pillars.find((entry) => entry.pillar.scoreId === scoreId);
      const previousYear = context.years.filter((year) => year < context.release.year).at(-1) ?? null;
      const result = {
        median: median(context.latest.map((unit) => unit.scores[scoreId]).filter(isNumber)),
        previousYear,
        change: null as number | null,
        comparedUnits: 0,
        totalUnits: context.latest.length,
        changedComponents: [] as string[],
      };
      if (!stats || previousYear === null) return result;
      const changes: number[] = [];
      const changed = new Map<string, number>();
      for (const unit of context.latest) {
        const before = context.history.get(unit.id)?.get(previousYear);
        const now = unit.scores[scoreId];
        const then = before?.scores[scoreId];
        if (!before || !isNumber(now) || !isNumber(then)) continue;
        if (statusSignature(context.statusOf, stats.pillar, before) === statusSignature(context.statusOf, stats.pillar, unit)) {
          changes.push(now - then);
          continue;
        }
        for (const component of stats.pillar.components) {
          if (context.statusOf(component.id, before) !== context.statusOf(component.id, unit)) changed.set(component.label, (changed.get(component.label) ?? 0) + 1);
        }
      }
      result.comparedUnits = changes.length;
      result.change = changes.length * 2 >= context.latest.length ? median(changes) : null;
      result.changedComponents = [...changed].sort((a, b) => b[1] - a[1]).map(([label]) => label.replace(/ Score$/, ""));
      return result;
    },
  };
}

/** One fact sheet per unit in the dataset's release year, in id order. */
export function buildFactSheets(dataset: AnalyticsDataset, country: CountryInfo): FactSheet[] {
  return createFactSheetBuilder(dataset, country).all();
}
