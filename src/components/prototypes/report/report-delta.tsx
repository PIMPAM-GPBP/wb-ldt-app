import { formatDelta } from "../shared/derive";

/**
 * A signed difference with a triangle, so direction never depends on color alone.
 * Green above the baseline, rust below it, plain muted text at zero.
 */
export function ReportDelta({
  value,
  digits = 1,
  className = "",
}: {
  value: number | null | undefined;
  digits?: number;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className={`text-[var(--proto-muted)] ${className}`}>n/a</span>;
  }

  const text = formatDelta(value, digits);
  if (Number(Math.abs(value).toFixed(digits)) === 0) {
    return <span className={`tabular-nums text-[var(--proto-muted)] ${className}`}>{text}</span>;
  }

  const above = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium tabular-nums ${
        above ? "text-[var(--proto-above)]" : "text-[var(--proto-below)]"
      } ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 8 8" className="size-2 shrink-0">
        <path d={above ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z"} fill="currentColor" />
      </svg>
      {text}
    </span>
  );
}
