import type { Pillar } from "@/types/analytics";

import type { FactSheet } from "./facts.ts";
import { coverageSection } from "./plan-sections.ts";
import { contentHash, sectionCommitments, type StoredCommitment } from "./review.ts";

/**
 * Sections two and three for one pillar, built the same way for the review console and the
 * brief, so a reviewer approves exactly what readers will see.
 */
export function pillarPlanView(sheet: FactSheet, pillarKey: Pillar, commitments: readonly StoredCommitment[], view: "reviewed" | "draft", hasPlan: boolean) {
  const componentKeys = sheet.pillars.find((pillar) => pillar.key === pillarKey)?.components.map((component) => component.key) ?? [];
  const shown = sectionCommitments(commitments, view).filter((commitment) => commitment.components.some((key) => componentKeys.includes(key)));
  return { componentKeys, commitments: shown, ...coverageSection(sheet, pillarKey, shown, hasPlan) };
}

/** The hash a review of this pillar records, and that the public view must still match. */
export function pillarContentHash(sheet: FactSheet, pillarKey: Pillar, commitments: readonly StoredCommitment[]) {
  const componentKeys = sheet.pillars.find((pillar) => pillar.key === pillarKey)?.components.map((component) => component.key) ?? [];
  return contentHash(pillarKey, sheet.version, sectionCommitments(commitments, "reviewed"), componentKeys);
}
