import type { ScoreWaterfallGroup } from "@/types/analytics";

export type EvidenceGapTone = "missing" | "sparse" | "blocked";

export type EvidenceGapBadge = {
  tone: EvidenceGapTone;
  label: string;
  detail: string;
};

export function deriveScatterEvidenceGap(
  points: Array<{ x: number | null; y: number | null }>,
): EvidenceGapBadge | null {
  const missing = points.filter((point) => point.x === null || point.y === null).length;

  if (missing === 0) {
    return null;
  }

  if (missing === points.length) {
    return {
      tone: "blocked",
      label: "Evidence gap",
      detail: "No comparable score pairs are available for this scatterplot.",
    };
  }

  return {
    tone: "sparse",
    label: `${missing} missing pairs`,
    detail: "Some places are hidden because one or both selected metrics are missing.",
  };
}

export function deriveWaterfallEvidenceGap(
  group: ScoreWaterfallGroup,
): EvidenceGapBadge | null {
  const missingRows = group.rows.filter((row) => row.contribution === null).length;

  if (
    group.municipalityScore === null ||
    group.nationalScore === null ||
    group.totalDifference === null
  ) {
    return {
      tone: "blocked",
      label: "Evidence gap",
      detail: "Score-driver evidence is incomplete for this selected score.",
    };
  }

  if (missingRows === 0) {
    return null;
  }

  return {
    tone: "sparse",
    label: `${missingRows} missing drivers`,
    detail: "Some score components are not shown because comparable values are missing.",
  };
}
