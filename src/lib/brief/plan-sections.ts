import type { Pillar } from "@/types/analytics";

import type { VerifiedCommitment } from "../plans/extract.ts";
import type { Fact, FactSheet, SheetComponent } from "./facts.ts";
import { formatNumber, type BriefSentence, type SentencePart } from "./section-one.ts";

/**
 * Sections two and three: what the local plan commits to, and where a weak score meets a
 * silent plan. Both rest on commitments the model extracted, so both are reviewed before
 * the public sees them (decision 3).
 */

/** A component this far from the national average, in points, is above or below it. */
export const AVERAGE_BAND = 10;

export type PlanCommitment = VerifiedCommitment & { planId: string; planUrl: string; planTitle: string };

export type ScoreStatus = "above average" | "near average" | "below average" | "not measured";
export type Salience = "high" | "medium" | "low" | "silent";

export type CoverageRow = {
  component: SheetComponent;
  scoreStatus: ScoreStatus;
  /** Component score minus its national average; null when not measured. */
  gap: number | null;
  salience: Salience;
  commitments: PlanCommitment[];
};

export const MACHINE_TRANSLATION = "Machine translation";

/** How much the plan says about a component: specific commitments count for more than general ones. */
export function salienceOf(commitments: readonly PlanCommitment[]): Salience {
  const specific = commitments.filter((commitment) => commitment.strength === "specific").length;
  if (commitments.length === 0) return "silent";
  if (commitments.length >= 3 && specific >= 1) return "high";
  if (specific >= 1 || commitments.length >= 3) return "medium";
  return "low";
}

export function coverageRows(sheet: FactSheet, pillarKey: Pillar, commitments: readonly PlanCommitment[]): CoverageRow[] {
  const pillar = sheet.pillars.find((entry) => entry.key === pillarKey);
  if (!pillar) return [];
  return pillar.components.map((component) => {
    const base = `${pillarKey}.component.${component.key}`;
    const measured = sheet.facts[`${base}.status`]?.value === "measured";
    const gap = measured ? (sheet.facts[`${base}.gap.national`]?.value as number | null) : null;
    const scoreStatus: ScoreStatus =
      gap === null ? "not measured" : gap >= AVERAGE_BAND ? "above average" : gap <= -AVERAGE_BAND ? "below average" : "near average";
    const mine = commitments.filter((commitment) => commitment.components.includes(component.key));
    return { component, scoreStatus, gap, salience: salienceOf(mine), commitments: mine };
  });
}

/**
 * The quote as shown: the stored text stays exact, but leading bullet glyphs from the PDF are
 * dropped, and symbol-font bullets inside it (private-use characters no page font can draw)
 * become "•".
 */
export const displayQuote = (quote: string) =>
  quote
    .replace(/^[^\p{L}\p{N}"„«(]+/u, "")
    .replace(/\s*\p{Co}+\s*/gu, " • ")
    .trim();

/** A quote's link opens the plan at the page the quote is on. */
export const pageLink = (commitment: Pick<PlanCommitment, "planUrl" | "page">) => `${commitment.planUrl}#page=${commitment.page}`;

/**
 * The sheet plus facts about the plan, so section three's sentences are checked by the
 * same verifier as section one's.
 */
export function withPlanFacts(sheet: FactSheet, pillarKey: Pillar, rows: readonly CoverageRow[]): FactSheet {
  const facts: Record<string, Fact> = { ...sheet.facts };
  const band = `${pillarKey}.plan.average_band`;
  facts[band] = { id: band, value: AVERAGE_BAND, label: "Points from the national average at which a component counts as above or below it", decimals: 0 };
  for (const row of rows) {
    const id = `${pillarKey}.plan.${row.component.key}.commitments`;
    facts[id] = { id, value: row.commitments.length, label: `Commitments in the local plan on ${row.component.label}`, decimals: 0 };
  }
  return { ...sheet, facts };
}

const componentName = (label: string) => label.replace(/ Score$/, "");

/** Section three's prose. `sheet` must carry the plan facts that withPlanFacts adds. */
function renderCoverageGaps(sheet: FactSheet, pillarKey: Pillar, rows: readonly CoverageRow[], hasPlan: boolean): BriefSentence[] {
  const sentence = (...parts: SentencePart[]): BriefSentence => ({
    kind: "gaps",
    parts,
    text: parts.map((part) => (typeof part === "string" ? part : part.text)).join(""),
    factIds: [...new Set(parts.flatMap((part) => (typeof part === "string" ? [] : [part.factId])))],
  });
  const bound = (id: string, text?: string): SentencePart => {
    const fact = sheet.facts[id];
    const value = typeof fact?.value === "number" ? formatNumber(fact.signed ? Math.abs(fact.value) : fact.value, fact.decimals ?? 1) : String(fact?.value ?? "");
    return { factId: id, text: text ?? value };
  };

  if (!hasPlan) return [sentence("No local plan with readable text is loaded, so coverage cannot be judged yet.")];

  const below = rows.filter((row) => row.scoreStatus === "below average");
  // A claim about every component at once, computed from the rows; it avoids comparison words,
  // which the verifier would rightly ask to see backed by a single cited fact.
  if (below.length === 0) {
    return [sentence("Every measured component scores within ", bound(`${pillarKey}.plan.average_band`), " points of the national average or better.")];
  }

  return below.map((row) => {
    const base = `${pillarKey}.component.${row.component.key}`;
    const name = bound(`${base}.status`, componentName(row.component.label));
    const head: SentencePart[] = [name, " scores ", bound(`${base}.value`), ", ", bound(`${base}.gap.national`), " points below the national average of ", bound(`${base}.national_average`)];
    const count = `${pillarKey}.plan.${row.component.key}.commitments`;
    return row.salience === "silent"
      ? sentence(...head, ", and the local plan makes no commitment on it.")
      : sentence(...head, "; the local plan makes ", bound(count), row.commitments.length === 1 ? " commitment on it." : " commitments on it.");
  });
}

/**
 * Section three for one pillar: the matrix rows, the sentences naming every component below
 * the national average, and the sheet with plan facts that those sentences must verify against.
 */
export function coverageSection(sheet: FactSheet, pillarKey: Pillar, commitments: readonly PlanCommitment[], hasPlan: boolean) {
  const rows = coverageRows(sheet, pillarKey, commitments);
  const checkedAgainst = withPlanFacts(sheet, pillarKey, rows);
  return { rows, sheet: checkedAgainst, sentences: renderCoverageGaps(checkedAgainst, pillarKey, rows, hasPlan) };
}
