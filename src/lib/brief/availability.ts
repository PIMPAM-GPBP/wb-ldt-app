import type { MunicipalityRecord } from "@/types/analytics";

import { scoreComponentIndicatorMappings } from "../data/labels.ts";

/**
 * Whether a score component rests on a measurement.
 *
 * The score pipeline turns a raw indicator value of 0 into a fixed score, so a
 * component score can exist where nothing was measured. Every Nepal unit shows
 * 0% health access and 0 tourism sites in 2021, and a broadband speed of 0 is not
 * a speed. Son settled on 30 October 2026 that such values are shown with a note
 * but never used as drivers, trends, or neighbour dimensions.
 */
export type ComponentStatus = "measured" | "not recorded" | "not applicable" | "missing";

type UnitValues = Pick<MunicipalityRecord, "indicators" | "scoreComponents" | "context">;

/** Indicators whose raw 0 means nothing was recorded, not a measured zero. */
const ZERO_IS_UNRECORDED = new Set([
  "accessibility-to-health-services",
  "accessibility-to-school-services",
  "number-of-tourism-pois",
  "average-broadband-download-speed",
  "average-cellular-download-speed",
  "co2-equivalent-emissions-tonnes",
  "co2-equivalent-emissions-per-area",
]);

/** Risk indicators that do not apply when the unit has none of the asset at risk. */
const ASSET_FOR_RISK: Record<string, keyof MunicipalityRecord["context"]> = {
  "railway-flood-risk": "totalRailwayLengthKm",
  "railway-heatwave-risk": "totalRailwayLengthKm",
  "road-flood-risk": "totalRoadLengthKm",
  "road-heatwave-risk": "totalRoadLengthKm",
};

export function indicatorForComponent(componentId: string): string | null {
  return (scoreComponentIndicatorMappings as Record<string, string>)[componentId] ?? null;
}

/**
 * Context fields with a value for at least one unit in the record's year. Road and
 * railway lengths are 0 for every unit before 2025 because they were not computed,
 * so a 0 then says nothing about whether the unit has roads.
 */
export type YearCoverage = { computedContext: ReadonlySet<string> };

export function yearCoverage(units: readonly Pick<MunicipalityRecord, "context">[]): YearCoverage {
  const computedContext = new Set<string>();
  for (const unit of units) {
    for (const [field, value] of Object.entries(unit.context)) {
      if (typeof value === "number" && value !== 0) computedContext.add(field);
    }
  }
  return { computedContext };
}

export function componentStatus(componentId: string, unit: UnitValues, coverage?: YearCoverage): ComponentStatus {
  if (unit.scoreComponents[componentId] == null) return "missing";

  const indicatorId = indicatorForComponent(componentId);
  if (!indicatorId) return "measured";
  const raw = unit.indicators[indicatorId];

  const asset = ASSET_FOR_RISK[indicatorId];
  if (asset && coverage && !coverage.computedContext.has(asset)) return "not recorded";
  if (asset && unit.context[asset] === 0) return "not applicable";

  if (ZERO_IS_UNRECORDED.has(indicatorId) && raw === 0) return "not recorded";

  // The share of schools and hospitals without broadband comes from the same speed
  // tests as broadband speed; it sits at exactly 0 or 100 for 704 of 751 Nepal units,
  // and 546 of those have no recorded speed, so it counts only where speed was recorded.
  if (indicatorId === "key-structures-without-internet-access" && unit.indicators["average-broadband-download-speed"] === 0) {
    return "not recorded";
  }

  return "measured";
}
