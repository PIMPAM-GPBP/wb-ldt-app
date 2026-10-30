"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { PILLARS, groupMetricsByPillar, type PillarMetricGroup } from "@/lib/analytics/derive";
import { cn } from "@/lib/utils";
import type { IndicatorDefinition, MetricDefinition, Pillar, ScoreDefinition } from "@/types/analytics";

import { FOCUS_RING, PANEL_LABEL, TEXT_FIELD } from "./panel-styles";

export type AtlasIndicatorRailProps = {
  metrics: MetricDefinition[];
  activeMetricId: string;
  /** Definition of the active metric when it is an indicator, else null. */
  selectedMetricDefinition: IndicatorDefinition | null;
  /** The composite score the active metric belongs to. */
  scoreDefinition: ScoreDefinition;
  onSelectMetric: (metricId: string) => void;
  isPending: boolean;
};

function colorFor(pillar: Pillar | null) {
  return PILLARS.find((entry) => entry.id === pillar)?.cssVar ?? "var(--ink-muted)";
}

function keyFor(group: PillarMetricGroup) {
  return group.pillar ?? "other";
}

export function AtlasIndicatorRail({
  metrics,
  activeMetricId,
  selectedMetricDefinition,
  scoreDefinition,
  onSelectMetric,
  isPending,
}: AtlasIndicatorRailProps) {
  const baseId = useId();
  const definitionId = `${baseId}-definition`;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Partial<Record<string, boolean>>>({});
  const [pending, setPending] = useState<{ id: string; from: string } | null>(null);

  const groups = groupMetricsByPillar(metrics);
  const activeGroup = groups.find(
    (group) => group.score?.id === activeMetricId || group.indicators.some((metric) => metric.id === activeMetricId),
  );
  const activeKey = activeGroup ? keyFor(activeGroup) : null;
  const activeUnit = metrics.find((metric) => metric.id === activeMetricId)?.unit ?? null;

  // When the active metric moves into another group from outside the rail, open that group.
  const [trackedKey, setTrackedKey] = useState(activeKey);
  if (trackedKey !== activeKey) {
    setTrackedKey(activeKey);
    if (activeKey) setExpanded((current) => ({ ...current, [activeKey]: true }));
  }

  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0;
  const rows = groups
    .map((group) => {
      const items: { id: string; label: string }[] = [
        ...(group.score ? [{ id: group.score.id, label: `${group.label} score` }] : []),
        ...group.indicators.map((metric) => ({ id: metric.id, label: metric.name })),
      ];
      return {
        key: keyFor(group),
        label: group.label,
        color: colorFor(group.pillar),
        items: filtering ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items,
      };
    })
    .filter((row) => !filtering || row.items.length > 0);

  // A pending click keeps its item active until the server render lands; a stale pending id is ignored.
  const shownActiveId = isPending && pending?.from === activeMetricId ? pending.id : activeMetricId;
  const isExpanded = (key: string) => expanded[key] ?? key === activeKey;

  function selectMetric(metricId: string) {
    setPending({ id: metricId, from: activeMetricId });
    onSelectMetric(metricId);
  }

  const componentCount = scoreDefinition.componentLabels.length;
  const measureNotes = [
    activeUnit ? `Measured in ${activeUnit}` : null,
    selectedMetricDefinition?.higherIsBetter === true ? "Higher is better" : null,
    selectedMetricDefinition?.higherIsBetter === false ? "Lower is better" : null,
  ].filter((note): note is string => note !== null);

  return (
    <div className="flex flex-col">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query) {
            event.preventDefault();
            setQuery("");
          }
        }}
        aria-label="Filter indicators"
        placeholder="Filter indicators"
        autoComplete="off"
        spellCheck={false}
        className={cn(TEXT_FIELD, FOCUS_RING)}
      />

      <div className="mt-2">
        {rows.map((row) => {
          // While filtering, matching groups are always open and their headers are not toggles.
          const open = filtering || isExpanded(row.key);
          const panelId = `${baseId}-${row.key}`;
          return (
            <div key={row.key} className="border-t border-[var(--border-soft)] first:border-t-0">
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  disabled={filtering}
                  onClick={() => setExpanded((current) => ({ ...current, [row.key]: !open }))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-2.5 text-left disabled:cursor-default",
                    FOCUS_RING,
                  )}
                >
                  <span aria-hidden="true" className="h-[3px] w-4 shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="font-heading text-sm font-semibold text-ink">{row.label}</span>
                  {open ? (
                    <ChevronDown aria-hidden="true" className="ml-auto size-4 shrink-0 text-ink-muted" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-ink-muted" />
                  )}
                </button>
              </h3>
              <ul id={panelId} hidden={!open} className="pb-2">
                {row.items.map((item) => {
                  const isActive = item.id === shownActiveId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => selectMetric(item.id)}
                        className={cn(
                          "relative flex min-h-11 w-full items-center rounded-md py-1.5 pl-6 pr-2 text-left text-sm leading-snug transition-colors duration-150 motion-reduce:transition-none md:min-h-9",
                          isActive ? "font-medium text-ink" : "text-ink-muted hover:text-ink",
                          FOCUS_RING,
                        )}
                      >
                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1.5 left-0 w-[2px]"
                            style={{ backgroundColor: row.color }}
                          />
                        ) : null}
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {filtering && rows.length === 0 ? (
          <p role="status" className="px-0 py-3 text-sm text-ink-muted">
            No indicators match
          </p>
        ) : null}
      </div>

      <section aria-labelledby={definitionId} className="mt-4 border-t border-[var(--border-soft)] pt-4">
        <h3 id={definitionId} className={PANEL_LABEL}>
          About this measure
        </h3>
        {selectedMetricDefinition ? (
          <div className="mt-3 space-y-3">
            <p className={cn("text-sm leading-6", selectedMetricDefinition.description ? "text-ink" : "text-ink-muted")}>
              {selectedMetricDefinition.description || "No description yet"}
            </p>
            {measureNotes.length > 0 ? <p className="text-xs text-ink-muted">{measureNotes.join(". ")}</p> : null}
            {selectedMetricDefinition.sources.length > 0 ? (
              <div>
                <p className="text-xs text-ink-muted">Sources</p>
                <ul className="mt-1 space-y-1">
                  {selectedMetricDefinition.sources.map((source, index) => (
                    <li key={`${index}-${source.url}`}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "rounded-md text-xs text-accent underline underline-offset-2 hover:text-ink",
                          FOCUS_RING,
                        )}
                      >
                        {source.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink">
              Composite of {componentCount} {componentCount === 1 ? "component" : "components"}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs leading-5 text-ink-muted">
              {scoreDefinition.componentLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
