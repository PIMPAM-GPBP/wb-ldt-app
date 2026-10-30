import type { EvidenceGapBadge as EvidenceGapBadgeModel } from "@/lib/evidence-gaps";

// A gap is a status, so it takes a status color: destructive when blocked, the below-baseline
// color when sparse, and plain muted text when a result simply has not been made yet.
function toneClassName(tone: EvidenceGapBadgeModel["tone"]) {
  if (tone === "blocked") {
    return "border-destructive text-destructive";
  }

  if (tone === "sparse") {
    return "border-delta-below text-delta-below";
  }

  return "border-[var(--border-strong)] text-ink-muted";
}

export function EvidenceGapBadge({ gap }: { gap: EvidenceGapBadgeModel }) {
  return (
    <span
      className={`inline-flex max-w-full items-baseline gap-2 border-l-2 pl-2 text-sm leading-5 ${toneClassName(gap.tone)}`}
      title={gap.detail}
    >
      <span className="font-semibold">Evidence gap</span>
      <span className="truncate">{gap.label}</span>
      <span className="sr-only">{gap.detail}</span>
    </span>
  );
}
