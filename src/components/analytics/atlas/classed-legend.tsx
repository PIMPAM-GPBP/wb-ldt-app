"use client";

import type { MapClass, MapClassification } from "@/lib/analytics/derive";
import type { AdminLabels } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { MetricDefinition } from "@/types/analytics";

import { createMetricFormatter } from "./format-metric";

/**
 * Classed legend that doubles as a map filter: one button per class, each toggling the map's
 * legend filter. Pair it with AtlasMap's activeClassIndex.
 */
export type ClassedLegendProps = {
  classification: MapClassification;
  metric: MetricDefinition;
  activeClassIndex: number | null;
  /** Toggle a class on or off. Passing null clears the filter. */
  onToggle: (index: number | null) => void;
  orientation?: "horizontal" | "vertical";
  /**
   * "compact" is one strip of swatches with each class edge printed once underneath, and no per-class
   * counts or hint, for narrow panels. It always lays out horizontally, whatever `orientation` says.
   * Defaults to "default".
   */
  density?: "default" | "compact";
  /** Names the counted units in screen reader labels, such as "municipalities". Defaults to "units". */
  adminLabels?: AdminLabels;
  className?: string;
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BUTTON_BASE =
  "flex rounded-md border text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

function Swatch({ color, className, dimmed = false }: { color: string; className: string; dimmed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-sm border border-[var(--border-strong)] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        className,
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
  adminLabels,
  className,
}: ClassedLegendProps) {
  const compact = density === "compact";
  const horizontal = compact || orientation === "horizontal";
  const filtered = activeClassIndex !== null;
  const noun = adminLabels?.lower.plural.toLowerCase() ?? "units";
  const { edge } = createMetricFormatter(classification);
  const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
  const noDataCount = classification.nullCount.toLocaleString("en-US");

  const rangeOf = (entry: MapClass, joiner: string) => `${edge(entry.min)}${joiner}${edge(entry.max)}`;
  // A dash between two edges reads badly next to a minus sign, so a range with a negative edge says "to".
  const visibleRange = (entry: MapClass) => rangeOf(entry, entry.min < 0 || entry.max < 0 ? " to " : "–");

  const activeClass = classification.classes.find((entry) => entry.index === activeClassIndex);
  const announcement = activeClass
    ? `Showing ${activeClass.count.toLocaleString("en-US")} ${noun} from ${rangeOf(activeClass, " to ")}${unitSuffix}.`
    : "";

  function classButton(entry: MapClass, layout: string, content: React.ReactNode) {
    const pressed = activeClassIndex === entry.index;
    const count = entry.count.toLocaleString("en-US");
    return (
      <button
        key={entry.index}
        type="button"
        aria-pressed={pressed}
        aria-label={`${rangeOf(entry, " to ")}${unitSuffix}: ${count} ${noun}`}
        title={compact ? `${visibleRange(entry)}${unitSuffix}: ${count} ${noun}` : undefined}
        onClick={() => onToggle(pressed ? null : entry.index)}
        className={cn(
          BUTTON_BASE,
          layout,
          pressed ? "border-[var(--accent-strong)] bg-background" : "border-transparent hover:bg-background",
          FOCUS_RING,
        )}
      >
        {content}
      </button>
    );
  }

  const noDataLabel = <span className="sr-only">No data, {noDataCount}</span>;

  // Class edges, low to high: the first class's minimum, then every class's maximum.
  const edges = classification.classes.length === 0 ? [] : [classification.classes[0].min, ...classification.classes.map((entry) => entry.max)];
  const lastEdge = edges.length - 1;

  return (
    <div
      role="group"
      aria-label={`Filter the map by ${metric.name}`}
      className={cn("text-ink", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && filtered) onToggle(null);
      }}
    >
      <div className={cn("flex items-baseline justify-between gap-x-3", compact ? "min-h-5" : "min-h-7")}>
        <p
          className={cn("min-w-0 text-[13px] leading-snug [overflow-wrap:anywhere]", compact && "line-clamp-2")}
          title={metric.unit ? `${metric.name} (${metric.unit})` : metric.name}
        >
          <span className="font-medium">{metric.name}</span>
          {metric.unit ? <span className="ml-1.5 text-ink-muted">{metric.unit}</span> : null}
          {metric.higherIsBetter === false ? (
            <span className="ml-2 inline-block whitespace-nowrap text-ink-muted">Lower is better</span>
          ) : null}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={() => onToggle(null)}
            className={cn(
              "-mx-1 shrink-0 rounded-md px-1 text-xs font-medium text-accent max-md:min-h-11 max-md:px-2",
              "underline-offset-2 hover:underline",
              FOCUS_RING,
            )}
          >
            Show all
          </button>
        ) : null}
      </div>

      {compact ? (
        <div className="mt-1 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex gap-0.5">
              {classification.classes.map((entry) =>
                classButton(
                  entry,
                  "min-w-0 flex-1 px-0.5 py-1.5",
                  <Swatch color={entry.color} className="h-2.5 w-full" dimmed={filtered && activeClassIndex !== entry.index} />,
                ),
              )}
            </div>
            <div
              aria-hidden="true"
              className="relative mt-0.5 h-4 text-[10px] font-medium leading-4 tracking-tight tabular-nums text-ink"
            >
              {edges.map((value, index) => (
                <span
                  key={index}
                  className={cn(
                    "absolute top-0 whitespace-nowrap",
                    index === 0 && "left-0",
                    index === lastEdge && "right-0",
                    index > 0 && index < lastEdge && "-translate-x-1/2",
                  )}
                  style={index > 0 && index < lastEdge ? { left: `${(index / lastEdge) * 100}%` } : undefined}
                >
                  {edge(value)}
                </span>
              ))}
            </div>
          </div>
          {classification.nullCount > 0 ? (
            <div className="w-8 flex-none text-ink-muted">
              <div className="border border-transparent px-0.5 py-1.5">
                <Swatch color={classification.noDataColor} className="h-2.5 w-full" />
              </div>
              <div aria-hidden="true" className="mt-0.5 h-4 text-center text-[10px] font-medium leading-4">
                n/a
              </div>
              {noDataLabel}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn("mt-1.5 flex gap-1", horizontal ? "flex-wrap" : "flex-col")}>
          {classification.classes.map((entry) =>
            classButton(
              entry,
              horizontal
                ? "min-w-[5.5rem] flex-1 flex-col items-stretch gap-1 px-1.5 py-1.5 max-md:min-h-11"
                : "w-full flex-row items-center gap-2 px-1.5 py-1.5 max-md:min-h-11",
              <>
                <Swatch
                  color={entry.color}
                  className={horizontal ? "h-2.5 w-full" : "h-3 w-5"}
                  dimmed={filtered && activeClassIndex !== entry.index}
                />
                <span className={cn("flex items-baseline gap-2", !horizontal && "flex-1 justify-between")}>
                  <span className="text-xs font-medium tabular-nums">{visibleRange(entry)}</span>
                  <span className="text-xs tabular-nums text-ink-muted">{entry.count.toLocaleString("en-US")}</span>
                </span>
              </>,
            ),
          )}
          {classification.nullCount > 0 ? (
            <div
              className={cn(
                "flex border border-transparent text-ink-muted",
                horizontal
                  ? "min-w-[5.5rem] flex-1 flex-col items-stretch gap-1 px-1.5 py-1.5"
                  : "w-full flex-row items-center gap-2 px-1.5 py-1.5",
              )}
            >
              <Swatch color={classification.noDataColor} className={horizontal ? "h-2.5 w-full" : "h-3 w-5"} />
              <span className={cn("flex items-baseline gap-2 text-xs tabular-nums", !horizontal && "flex-1 justify-between")}>
                <span>No data</span>
                <span>{noDataCount}</span>
              </span>
            </div>
          ) : null}
        </div>
      )}

      {classification.classes.length === 0 && classification.nullCount === 0 ? (
        <p className="mt-1.5 text-xs text-ink-muted">No values to show.</p>
      ) : null}
      {compact || classification.classes.length === 0 ? null : (
        <p className="mt-1.5 text-xs text-ink-muted">Select a range to filter the map</p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
