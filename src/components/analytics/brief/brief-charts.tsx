// SVG charts for the planning brief. They render on the server and print as drawn.
// Every chart is aria-hidden; the row or caption beside it carries the same numbers as text.
import { formatDelta } from "@/lib/analytics/derive";
import { cn } from "@/lib/utils";

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const pct = (value: number) => `${clamp(value)}%`;

/**
 * Every unit's score as a faint tick on a 0 to 100 axis, the national average as a solid
 * tick, the province average as a dashed one, and this unit as a dot in the pillar's color.
 */
export function ScoreStrip({
  distribution,
  value,
  national,
  province,
  color,
}: {
  distribution: readonly number[];
  value: number | null;
  national: number | null;
  province: number | null;
  color: string;
}) {
  return (
    <svg aria-hidden="true" width="100%" height="22" className="block overflow-visible">
      <line x1="0" x2="100%" y1="11" y2="11" strokeWidth="1" style={{ stroke: "var(--border-strong)" }} />
      {distribution.map((entry, index) => (
        <line key={index} x1={pct(entry)} x2={pct(entry)} y1="7" y2="15" strokeWidth="1" style={{ stroke: "var(--ink-muted)", strokeOpacity: 0.28 }} />
      ))}
      {national !== null ? <line x1={pct(national)} x2={pct(national)} y1="2" y2="20" strokeWidth="1.5" style={{ stroke: "var(--ink)" }} /> : null}
      {province !== null ? (
        <line x1={pct(province)} x2={pct(province)} y1="2" y2="20" strokeWidth="1.5" strokeDasharray="2 2" style={{ stroke: "var(--ink)" }} />
      ) : null}
      {value !== null ? <circle cx={pct(value)} cy="11" r="5.5" strokeWidth="2" style={{ fill: color, stroke: "var(--background)" }} /> : null}
    </svg>
  );
}

/**
 * One component on a 0 to 100 axis: a bar from the national average to this unit's value,
 * green above and red below, ending in a dot in the pillar's color.
 */
export function ComponentDot({ value, national, province, color }: { value: number; national: number | null; province: number | null; color: string }) {
  const from = national ?? value;
  const above = value >= from;
  return (
    <svg aria-hidden="true" width="100%" height="18" className="block overflow-visible">
      <line x1="0" x2="100%" y1="9" y2="9" strokeWidth="1" style={{ stroke: "var(--border-soft)" }} />
      {[25, 50, 75].map((tick) => (
        <line key={tick} x1={`${tick}%`} x2={`${tick}%`} y1="6" y2="12" strokeWidth="1" style={{ stroke: "var(--border-soft)" }} />
      ))}
      <line
        x1={pct(Math.min(from, value))}
        x2={pct(Math.max(from, value))}
        y1="9"
        y2="9"
        strokeWidth="4"
        style={{ stroke: above ? "var(--delta-above)" : "var(--delta-below)", strokeOpacity: 0.55 }}
      />
      {province !== null ? (
        <line x1={pct(province)} x2={pct(province)} y1="1" y2="17" strokeWidth="1.5" strokeDasharray="2 2" style={{ stroke: "var(--ink)" }} />
      ) : null}
      {national !== null ? <line x1={pct(national)} x2={pct(national)} y1="1" y2="17" strokeWidth="1.5" style={{ stroke: "var(--ink)" }} /> : null}
      <circle cx={pct(value)} cy="9" r="5" strokeWidth="2" style={{ fill: color, stroke: "var(--background)" }} />
    </svg>
  );
}

/** A small line of the score by year. Dashed and muted when the years do not compare. */
export function Sparkline({ points, comparable, color }: { points: ReadonlyArray<{ year: number; value: number | null }>; comparable: boolean; color: string }) {
  const known = points.filter((point): point is { year: number; value: number } => point.value !== null);
  if (known.length < 2) return null;
  const values = known.map((point) => point.value);
  // At least a 30-point window, so a one-point wobble stays flat and a real move shows.
  const mid = (Math.min(...values) + Math.max(...values)) / 2;
  const low = Math.max(0, Math.min(Math.min(...values) - 5, mid - 15));
  const high = Math.min(100, Math.max(Math.max(...values) + 5, mid + 15));
  const width = 240;
  const height = 56;
  const x = (index: number) => 6 + (index / (known.length - 1)) * (width - 12);
  const y = (value: number) => 6 + (1 - (value - low) / (high - low || 1)) * (height - 12);
  const path = known.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const last = known[known.length - 1];
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block overflow-visible">
      <path
        d={path}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={comparable ? undefined : "4 4"}
        vectorEffect="non-scaling-stroke"
        style={{ stroke: comparable ? color : "var(--ink-muted)" }}
      />
      <circle cx={x(known.length - 1)} cy={y(last.value)} r="4" style={{ fill: comparable ? color : "var(--ink-muted)" }} />
    </svg>
  );
}

/** A 0 to 100 bar, for the similar-units list. */
export function ScoreBar({ value, color, emphasis }: { value: number | null; color: string; emphasis: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-2 w-full rounded-[2px] bg-[var(--surface-muted)]">
      {value !== null ? (
        <span
          className={cn("absolute inset-y-0 left-0 rounded-[2px]", !emphasis && "opacity-45")}
          style={{ width: pct(value), backgroundColor: emphasis ? color : "var(--ink-muted)" }}
        />
      ) : null}
    </span>
  );
}

function Triangle({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 8" className="size-2 shrink-0">
      <path d={up ? "M4 1 L7.5 7 H0.5 Z" : "M4 7 L7.5 1 H0.5 Z"} fill="currentColor" />
    </svg>
  );
}

/** A signed difference with a triangle, so direction never rests on color alone. */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn("text-ink-muted", className)}>n/a</span>;
  if (Number(Math.abs(value).toFixed(1)) === 0) return <span className={cn("tabular-nums text-ink-muted", className)}>0.0</span>;
  const up = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", up ? "text-delta-above" : "text-delta-below", className)}>
      <Triangle up={up} />
      {formatDelta(value, 1)}
    </span>
  );
}

/** The marks the strips and dot rows use, named once under the score strip. */
export function ChartKey({ unitName, provinceName, unitSingular }: { unitName: string; provinceName: string; unitSingular: string }) {
  const glyph = (kind: "tick" | "national" | "province" | "unit") => (
    <svg aria-hidden="true" width="10" height="14" viewBox="0 0 10 14" className="shrink-0">
      {kind === "tick" ? <line x1="5" x2="5" y1="4" y2="10" strokeWidth="1" style={{ stroke: "var(--ink-muted)", strokeOpacity: 0.6 }} /> : null}
      {kind === "national" ? <line x1="5" x2="5" y1="0" y2="14" strokeWidth="1.5" style={{ stroke: "var(--ink)" }} /> : null}
      {kind === "province" ? <line x1="5" x2="5" y1="0" y2="14" strokeWidth="1.5" strokeDasharray="2 2" style={{ stroke: "var(--ink)" }} /> : null}
      {kind === "unit" ? <circle cx="5" cy="7" r="4" style={{ fill: "var(--ink-muted)" }} /> : null}
    </svg>
  );
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">{glyph("unit")}{unitName}</span>
      <span className="inline-flex items-center gap-1.5">{glyph("national")}National average</span>
      <span className="inline-flex items-center gap-1.5">{glyph("province")}{provinceName} average</span>
      <span className="inline-flex items-center gap-1.5">{glyph("tick")}Each {unitSingular}</span>
    </p>
  );
}
