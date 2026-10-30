import type { Pillar } from "@/types/analytics";

import type { Fact, FactSheet, SheetPillar } from "./facts.ts";

/**
 * Section one, position and drivers, rendered from the fact sheet by code alone.
 * The public sees this text before any review (decision 4), so every sentence
 * here must pass the same verifier the model's prose does.
 */

export type SentencePart = string | { factId: string; text: string };

/** Which part of section one a sentence states; the brief groups them into paragraphs by it. */
// "gaps" is section three's, which reuses the sentence shape and the verifier.
export type SentenceKind = "position" | "band" | "change" | "drivers" | "coverage" | "neighbours" | "gaps";

export type BriefSentence = {
  kind: SentenceKind;
  /** The sentence in pieces; a fact-bound piece keeps its local fact id. */
  parts: SentencePart[];
  text: string;
  factIds: string[];
};

export function formatNumber(value: number, decimals = 1) {
  return value.toFixed(decimals).replace(/\.0+$/, "");
}

/** How a fact reads in a sentence: numbers to their decimals, signed numbers as a size without sign. */
export function formatFact(fact: Fact) {
  if (typeof fact.value === "number") {
    return formatNumber(fact.signed ? Math.abs(fact.value) : fact.value, fact.decimals ?? 1);
  }
  return fact.value ?? "";
}

function sentence(kind: SentenceKind, ...parts: Array<SentencePart | null | false | undefined>): BriefSentence {
  const kept = parts.filter((part): part is SentencePart => Boolean(part));
  const text = kept.map((part) => (typeof part === "string" ? part : part.text)).join("");
  const factIds = [...new Set(kept.flatMap((part) => (typeof part === "string" ? [] : [part.factId])))];
  return { kind, parts: kept, text, factIds };
}

/** Joins items as "a", "a and b", or "a, b and c". */
function list(items: SentencePart[][]): SentencePart[] {
  return items.flatMap((item, index) => [
    ...(index === 0 ? [] : [index === items.length - 1 ? " and " : ", "]),
    ...item,
  ]);
}

const componentName = (label: string) => label.replace(/ Score$/, "");

const ASSET_NOUNS: Record<string, string> = {
  railway_flood: "railway",
  railway_heatwave: "railway",
  road_flood: "roads",
  road_heatwave: "roads",
};

export function renderSectionOne(sheet: FactSheet, pillarKey: Pillar): BriefSentence[] {
  const pillar = sheet.pillars.find((entry) => entry.key === pillarKey);
  if (!pillar) return [];

  const p = pillar.key;
  const fact = (id: string) => sheet.facts[id];
  const value = (id: string) => fact(id)?.value ?? null;
  const bound = (id: string, text = formatFact(fact(id))): SentencePart => ({ factId: id, text: String(text) });
  const unitName = sheet.unit.name;
  const unitPlural = sheet.country.unit.plural.toLowerCase();
  const componentOf = (key: string) => pillar.components.find((component) => component.key === key);
  const componentPart = (factId: string): SentencePart => {
    const key = String(value(factId));
    return bound(factId, componentName(componentOf(key)?.label ?? key));
  };

  if (typeof value(`${p}.score`) !== "number") {
    return [sentence("position", `${unitName} has no ${pillar.label} for `, bound("release.year"), ".")];
  }

  const sentences: BriefSentence[] = [];

  // Position: the score against two reference points, as GSS guidance asks.
  const gapClause = (scope: "national" | "province", averageName: string): SentencePart[] => {
    const gap = value(`${p}.gap.${scope}`);
    const average = `${p}.${scope}_average`;
    if (typeof gap !== "number") return [];
    if (formatNumber(Math.abs(gap)) === "0") return [`level with the ${averageName} of `, bound(average)];
    return [bound(`${p}.gap.${scope}`), ` points ${gap > 0 ? "above" : "below"} the ${averageName} of `, bound(average)];
  };
  const national = gapClause("national", "national average");
  const province = gapClause("province", `${sheet.unit.province} average`);
  sentences.push(
    sentence("position",
      `${unitName} scored `, bound(`${p}.score`), ` on the ${pillar.label} in `, bound("release.year"),
      national.length > 0 && ", ", ...national,
      province.length > 0 && (national.length > 0 ? ", and " : ", "), ...province,
      ".",
    ),
  );

  // Band: never a raw rank (decision 7).
  const nationalBand = value(`${p}.band.national`);
  const provinceBand = value(`${p}.band.province`);
  if (typeof nationalBand === "string") {
    sentences.push(
      sentence("band",
        "That puts it in the ", bound(`${p}.band.national`, nationalBand.toLowerCase()), ` of ${sheet.country.name}'s ${unitPlural}`,
        typeof provinceBand === "string" && ", and the ",
        typeof provinceBand === "string" && bound(`${p}.band.province`, provinceBand.toLowerCase()),
        typeof provinceBand === "string" && ` within ${sheet.unit.province}`,
        ".",
      ),
    );
  }

  // Change since the first comparable year, with the usual movement as the yardstick.
  const direction = value(`${p}.change.direction`);
  if (direction === "rose" || direction === "fell") {
    sentences.push(
      sentence("change",
        `It ${direction} `, bound(`${p}.change.points`), " points since ", bound(`${p}.change.base_year`), ", from ",
        bound(`${p}.change.base_score`), "; the usual year-to-year movement is ", bound(`${p}.stable_threshold`), " points.",
      ),
    );
  } else if (direction === "broadly stable") {
    sentences.push(
      sentence("change",
        "It has been broadly stable since ", bound(`${p}.change.base_year`), ", moving ", bound(`${p}.change.points`),
        " points against a usual year-to-year movement of ", bound(`${p}.stable_threshold`), ".",
      ),
    );
  } else if (direction === "not comparable") {
    const changed = Object.keys(sheet.facts).filter((id) => id.startsWith(`${p}.change.coverage_changed.`)).map((id) => [componentPart(id)]);
    sentences.push(
      sentence("change",
        "Its change since ", bound("release.first_year"), " is not stated, because ", ...list(changed),
        changed.length === 1 ? " was" : " were", " not recorded the same way in every year.",
      ),
    );
  }

  // Drivers: the measured components that move the gap most.
  const driverClause = (scope: "national" | "province"): SentencePart[][] => {
    const clauses: SentencePart[][] = [];
    for (const way of ["down", "up"] as const) {
      const ids = [1, 2].map((rank) => `${p}.driver.${scope}.${way}.${rank}`).filter((id) => fact(id));
      if (ids.length === 0) continue;
      const items = ids.map((id) => {
        const key = String(value(id));
        return [componentPart(id), " (", bound(`${p}.component.${key}.value`), " against ", bound(`${p}.component.${key}.${scope}_average`), ")"];
      });
      clauses.push([...list(items), way === "down" ? (ids.length === 1 ? " pulls it down most" : " pull it down most") : (ids.length === 1 ? " lifts it most" : " lift it most")]);
    }
    return clauses;
  };
  const nationalDrivers = driverClause("national");
  sentences.push(
    nationalDrivers.length > 0
      ? sentence("drivers", "Against the national average, ", ...nationalDrivers.flatMap((clause, index) => [index > 0 ? ", while " : "", ...clause]), ".")
      : sentence("drivers", "No measured component stands out against the national average."),
  );
  const sameDrivers = (["down", "up"] as const).every((way) =>
    [1, 2].every((rank) => value(`${p}.driver.national.${way}.${rank}`) === value(`${p}.driver.province.${way}.${rank}`)),
  );
  const provinceDrivers = driverClause("province");
  if (!sameDrivers && provinceDrivers.length > 0) {
    sentences.push(
      sentence("drivers", `Against the ${sheet.unit.province} average, `, ...provinceDrivers.flatMap((clause, index) => [index > 0 ? ", while " : "", ...clause]), "."),
    );
  }

  // Coverage: what the score rests on, and which parts of it are fixed values.
  const byStatus = (status: string) =>
    pillar.components.filter((component) => value(`${p}.component.${component.key}.status`) === status);
  const notRecorded = byStatus("not recorded");
  const notApplicable = byStatus("not applicable");
  const statusPart = (component: SheetPillar["components"][number]) => [bound(`${p}.component.${component.key}.status`, componentName(component.label))];
  if (notRecorded.length === 0 && notApplicable.length === 0) {
    sentences.push(sentence("coverage", "All ", bound(`${p}.coverage.components`), " components rest on measurements for ", bound("release.year"), "."));
  } else {
    const assets = [...new Set(notApplicable.map((component) => ASSET_NOUNS[component.key] ?? "asset at risk"))];
    sentences.push(
      sentence("coverage",
        "For ", bound("release.year"), ", ", bound(`${p}.coverage.measured`), " of ", bound(`${p}.coverage.components`), " components rest on measurements",
        notRecorded.length > 0 && "; ",
        ...(notRecorded.length > 0 ? list(notRecorded.map(statusPart)) : []),
        notRecorded.length > 0 && (notRecorded.length === 1 ? " has nothing recorded" : " have nothing recorded"),
        notApplicable.length > 0 && (notRecorded.length > 0 ? ", and " : "; "),
        ...(notApplicable.length > 0 ? list(notApplicable.map(statusPart)) : []),
        notApplicable.length > 0 && `${notApplicable.length === 1 ? " does" : " do"} not apply because ${unitName} has no ${assets.join(" or ")}`,
        `. The ${pillar.label} still counts the fixed value the source data gives ${notRecorded.length + notApplicable.length === 1 ? "that component" : "those components"}.`,
      ),
    );
  }

  // A driver recorded for few units is compared with an average made mostly of fixed values.
  const unitCount = value("country.unit_count");
  const thinDrivers = [
    ...new Set(
      Object.keys(sheet.facts)
        .filter((id) => id.startsWith(`${p}.driver.`))
        .map((id) => String(value(id))),
    ),
  ].filter((key) => typeof unitCount === "number" && Number(value(`${p}.component.${key}.recorded_units`)) < unitCount / 2);
  for (const key of thinDrivers) {
    const component = componentOf(key);
    sentences.push(
      sentence("coverage",
        bound(`${p}.component.${key}.status`, componentName(component?.label ?? key)), " is recorded for only ",
        bound(`${p}.component.${key}.recorded_units`), " of ", bound("country.unit_count"),
        ` ${unitPlural}, so its national average mostly reflects fixed values.`,
      ),
    );
  }

  // Neighbours: the most similar units, and where the closest one differs.
  const neighbours = [1, 2, 3].filter((index) => fact(`${p}.neighbour.${index}.name`));
  if (neighbours.length > 0) {
    const first = `${p}.neighbour.1`;
    const differs = value(`${first}.differs`);
    sentences.push(
      sentence("neighbours",
        `The most similar ${unitPlural} on these measures are `,
        ...list(neighbours.map((index) => [bound(`${p}.neighbour.${index}.name`), " (", bound(`${p}.neighbour.${index}.score`), ")"])),
        typeof differs === "string" && "; ",
        typeof differs === "string" && bound(`${first}.name`),
        typeof differs === "string" && " differs most on ",
        typeof differs === "string" && componentPart(`${first}.differs`),
        typeof differs === "string" && ", at ",
        typeof differs === "string" && bound(`${first}.differs_value`),
        typeof differs === "string" && " against ",
        typeof differs === "string" && bound(`${p}.component.${differs}.value`),
        typeof differs === "string" && ` in ${unitName}`,
        ".",
      ),
    );
  }

  return sentences;
}

