"use client";

import { cn } from "@/lib/utils";
import type { MetricDefinition } from "@/types/analytics";

import { splitUnit, type MapClassification } from "./derive";

/**
 * Classed legend that doubles as a map filter: one button per class, each toggling the map's
 * legend filter. Pair it with PrototypeMap's activeClassIndex.
 */
export type ClassedLegendProps = {
  classification: MapClassification;
  metric: MetricDefinition;
  activeClassIndex: number | null;
  /** Toggle a class on or off. Passing null clears the filter. */
  onToggle: (index: number | null) => void;
  orientation?: "horizontal" | "vertical";
  /**
   * "compact" is one row that never wraps, with no per-class counts and no hint, for narrow panels.
   * It always lays out horizontally, whatever `orientation` says. Defaults to "default".
   */
  density?: "default" | "compact";
  className?: string;
};

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";

function formatRange(min: number, max: number) {
  return `${min.toFixed(1)}–${max.toFixed(1)}`;
}

function Swatch({
  color,
  horizontal,
  compact,
  dimmed = false,
}: {
  color: string;
  horizontal: boolean;
  compact: boolean;
  dimmed?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-[2px] border border-[var(--proto-rule-strong)] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        horizontal ? (compact ? "h-2 w-full" : "h-2.5 w-full") : "h-3 w-5",
        dimmed && "opacity-35",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function ClassedLegend({
  classification,
  metric,
  activeClassIndex,
  onToggle,
  orientation = "horizontal",
  density = "default",
  className,
}: ClassedLegendProps) {
  const compact = density === "compact";
  const { name, unit } = splitUnit(metric.label);
  const horizontal = compact || orientation === "horizontal";
  const filtered = activeClassIndex !== null;
  const itemLayout = horizontal
    ? compact
      ? "min-w-0 flex-1 flex-col items-stretch gap-0.5 px-0.5 py-1"
      : "min-w-[5.5rem] flex-1 flex-col items-stretch gap-1 px-1.5 py-1.5"
    : "w-full flex-row items-center gap-2 px-1.5 py-1.5";
  const labelLayout = cn("flex items-baseline gap-2", !horizontal && "flex-1 justify-between");
  const rangeText = compact
    ? "whitespace-nowrap text-[10px] font-medium tracking-tight tabular-nums"
    : "text-xs font-medium tabular-nums";

  return (
    <div
      role="group"
      aria-label={`${metric.label} classes`}
      className={cn("text-[var(--proto-ink)]", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && filtered) onToggle(null);
      }}
    >
      <div
        className={cn(
          "flex items-baseline justify-between gap-x-3",
          compact ? "min-h-5 flex-nowrap" : "min-h-7 flex-wrap gap-y-0.5",
        )}
      >
        {compact ? (
          <p className="flex min-w-0 items-baseline gap-2 text-[13px] font-medium leading-snug" title={metric.label}>
            <span className="truncate">{name}</span>
            {metric.higherIsBetter === false ? (
              <span className="shrink-0 font-normal text-[var(--proto-muted)]">Lower is better</span>
            ) : null}
          </p>
        ) : (
          <p className="text-[13px] font-medium leading-snug">
            {name}
            {unit ? <span className="ml-1.5 font-normal text-[var(--proto-muted)]">{unit}</span> : null}
            {metric.higherIsBetter === false ? (
              <span className="ml-2 font-normal text-[var(--proto-muted)]">Lower is better</span>
            ) : null}
          </p>
        )}
        {filtered ? (
          <button
            type="button"
            onClick={() => onToggle(null)}
            className={cn(
              "-mx-1 shrink-0 rounded-[var(--proto-radius-control)] px-1 text-xs font-medium text-[var(--proto-link)] max-md:min-h-11 max-md:px-2",
              "underline-offset-2 hover:underline",
              FOCUS_RING,
            )}
          >
            Show all
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          compact ? "mt-1 flex flex-nowrap gap-0.5" : "mt-1.5 flex gap-1",
          !compact && (horizontal ? "flex-wrap" : "flex-col"),
        )}
      >
        {classification.classes.map((entry) => {
          const pressed = activeClassIndex === entry.index;
          const range = formatRange(entry.min, entry.max);
          return (
            <button
              key={entry.index}
              type="button"
              aria-pressed={pressed}
              title={compact ? `${range}: ${entry.count.toLocaleString("en-US")}` : undefined}
              onClick={() => onToggle(pressed ? null : entry.index)}
              className={cn(
                "flex rounded-[var(--proto-radius-control)] border text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 max-md:min-h-11",
                itemLayout,
                pressed
                  ? "border-[var(--proto-accent)] bg-[var(--proto-surface-sunken)]"
                  : "border-transparent hover:bg-[var(--proto-surface-sunken)]",
                FOCUS_RING,
              )}
            >
              <Swatch color={entry.color} horizontal={horizontal} compact={compact} dimmed={filtered && !pressed} />
              <span className={labelLayout}>
                <span className={rangeText}>{range}</span>
                {compact ? null : (
                  <span className="text-xs tabular-nums text-[var(--proto-muted)]">
                    {entry.count.toLocaleString("en-US")}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {classification.nullCount > 0 ? (
          <div
            className={cn(
              "flex border border-transparent text-[var(--proto-muted)]",
              itemLayout,
              compact && "min-w-0 flex-none",
            )}
          >
            <Swatch color={classification.noDataColor} horizontal={horizontal} compact={compact} />
            <span className={labelLayout}>
              {compact ? (
                <>
                  <span aria-hidden="true" className={rangeText}>
                    n/a
                  </span>
                  <span className="sr-only">No data, {classification.nullCount.toLocaleString("en-US")}</span>
                </>
              ) : (
                <>
                  <span className="text-xs tabular-nums">No data</span>
                  <span className="text-xs tabular-nums">{classification.nullCount.toLocaleString("en-US")}</span>
                </>
              )}
            </span>
          </div>
        ) : null}
      </div>

      {compact ? null : <p className="mt-1.5 text-xs text-[var(--proto-muted)]">Select a range to filter the map</p>}
    </div>
  );
}
