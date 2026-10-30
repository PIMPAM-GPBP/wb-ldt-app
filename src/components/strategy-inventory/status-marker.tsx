import { STATUS_COLORS } from "@/lib/strategy-inventory/public";
import type { ReadinessCategory } from "@/lib/strategy-inventory/types";

/** The dot beside a status label. A missing document gets an empty ring, so the status never rests on hue alone. */
export function StatusMarker({ status }: { status: ReadinessCategory }) {
  return status === "Missing" ? (
    <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full border-[1.5px] border-[var(--ink-muted)]" />
  ) : (
    <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
  );
}
