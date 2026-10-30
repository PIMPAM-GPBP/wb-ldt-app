import { createHash } from "node:crypto";

import type { PlanCommitment } from "./plan-sections.ts";

/**
 * What a reader may see of the model-derived sections (two and three) for one unit and pillar.
 * Every brief is reviewed before the public sees it (decision 3). Only the admin reviews, in the
 * local review console; nobody else sees a draft.
 */

export type CommitmentDecision = { decision: "accepted" | "rejected"; components: string[] | null; reviewedAt: string };

export type StoredCommitment = PlanCommitment & { id: string; review: CommitmentDecision | null };

export type UnitReview = {
  status: "reviewed" | "withheld";
  reviewedAt: string;
  contentHash: string;
  note: string | null;
};

export type Visibility =
  | { kind: "reviewed"; reviewedAt: string }
  | { kind: "in review" }
  | { kind: "withheld" };

/** A commitment with the reviewer's correction applied; rejected ones are gone. */
export function applyReview(commitment: StoredCommitment): StoredCommitment | null {
  if (commitment.review?.decision === "rejected") return null;
  return commitment.review?.components ? { ...commitment, components: commitment.review.components } : commitment;
}

/**
 * The commitments a section shows. The reviewed view holds only accepted ones; the draft view
 * also holds those nobody has decided on yet.
 */
export function sectionCommitments(commitments: readonly StoredCommitment[], view: "reviewed" | "draft") {
  return commitments
    .filter((commitment) => view === "draft" || commitment.review?.decision === "accepted")
    .map(applyReview)
    .filter((commitment): commitment is StoredCommitment => commitment !== null);
}

/** Commitments on a pillar's components that nobody has accepted or rejected yet. */
export function undecided(commitments: readonly StoredCommitment[], componentKeys: readonly string[]) {
  return commitments.filter((commitment) => !commitment.review && commitment.components.some((key) => componentKeys.includes(key)));
}

/**
 * Fingerprint of what the reviewed sections would show: the accepted commitments on the pillar
 * with their components, and the fact sheet version. A new extraction, a changed decision, or
 * a new fact sheet changes it, which reopens the review.
 */
export function contentHash(pillar: string, factSheetVersion: number, accepted: readonly StoredCommitment[], componentKeys: readonly string[]) {
  const onPillar = accepted
    .filter((commitment) => commitment.components.some((key) => componentKeys.includes(key)))
    .map((commitment) => [commitment.id, [...commitment.components].sort()])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify({ pillar, factSheetVersion, commitments: onPillar })).digest("hex");
}

export function visibility(review: UnitReview | null, currentHash: string): Visibility {
  if (review?.status === "withheld") return { kind: "withheld" };
  if (review?.status === "reviewed" && review.contentHash === currentHash) return { kind: "reviewed", reviewedAt: review.reviewedAt };
  return { kind: "in review" };
}
