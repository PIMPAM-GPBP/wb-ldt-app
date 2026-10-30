"use client";

import type { KeyboardEvent } from "react";

import { PILLARS, formatScore, type PillarStanding } from "../shared/derive";
import { ReportDelta } from "./report-delta";
import { ordinal } from "./report-format";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";

export function reportTabId(scoreId: string) {
  return `report-tab-${scoreId}`;
}

export type ReportPillarStripProps = {
  standings: PillarStanding[];
  /** Score id of the pillar whose tab is selected. */
  activeScoreId: string;
  /** Called with the pillar's composite score id. */
  onSelect: (scoreId: string) => void;
  /** Id of the tabpanel the tabs control. */
  panelId: string;
  unitName: string;
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

/** Thin 0 to 100 scale: the national median as a tick, the unit as a dot in the pillar color. */
function PillarScale({
  value,
  median,
  cssVar,
}: {
  value: number | null;
  median: number | null;
  cssVar: string;
}) {
  return (
    <span aria-hidden="true" className="relative mt-5 block h-[38px]">
      <span className="absolute inset-x-0 top-[9px] h-px bg-[var(--proto-rule-strong)]" />
      <span className="absolute left-0 top-[5px] h-[9px] w-px bg-[var(--proto-rule-strong)]" />
      <span className="absolute right-0 top-[5px] h-[9px] w-px bg-[var(--proto-rule-strong)]" />
      {median !== null ? (
        <>
          <span
            className="absolute top-[3px] h-[13px] w-0.5 -translate-x-1/2 bg-[var(--proto-ink)]"
            style={{ left: `${clampPercent(median)}%` }}
          />
          <span
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums text-[var(--proto-muted)]"
            style={{ left: `${Math.min(70, Math.max(30, clampPercent(median)))}%` }}
          >
            National median {formatScore(median, 1)}
          </span>
        </>
      ) : null}
      {value !== null ? (
        <span
          className="absolute top-[9px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--proto-surface)]"
          style={{ left: `${clampPercent(value)}%`, background: cssVar }}
        />
      ) : null}
      <span className="absolute bottom-0 left-0 text-xs tabular-nums text-[var(--proto-muted)]">0</span>
      <span className="absolute bottom-0 right-0 text-xs tabular-nums text-[var(--proto-muted)]">100</span>
    </span>
  );
}

/**
 * Three pillar scores as a tablist. The active tab sets which score the map and the sections below show.
 * Arrow keys move focus and Enter or Space selects, because each selection reloads the page data.
 */
export function ReportPillarStrip({ standings, activeScoreId, onSelect, panelId, unitName }: ReportPillarStripProps) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = standings.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={`Pillar scores for ${unitName}`}
      className="grid border-b border-[var(--proto-rule)] md:grid-cols-3"
    >
      {standings.map((standing, index) => {
        const pillar = PILLARS.find((entry) => entry.id === standing.pillar) ?? PILLARS[index];
        const active = standing.scoreId === activeScoreId;

        return (
          <button
            key={standing.scoreId}
            type="button"
            role="tab"
            id={reportTabId(standing.scoreId)}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(standing.scoreId)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`group relative block min-h-11 border-[var(--proto-rule)] pb-6 pt-5 text-left transition-transform duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none max-md:border-t first:max-md:border-t-0 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0 ${FOCUS}`}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 top-0 h-[3px] ${
                active ? "" : "bg-[var(--proto-rule)] group-hover:bg-[var(--proto-rule-strong)]"
              }`}
              style={active ? { background: pillar.cssVar } : undefined}
            />
            <span
              className={`block text-[15px] font-medium ${
                active ? "text-[var(--proto-ink)]" : "text-[var(--proto-muted)]"
              }`}
            >
              {pillar.label}
            </span>
            <span className="mt-2 block font-heading text-[32px] font-semibold leading-none tabular-nums text-[var(--proto-ink)] md:text-[44px]">
              {formatScore(standing.value, 1)}
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm">
              <ReportDelta value={standing.delta} />
              <span className="text-[var(--proto-muted)]">vs national average</span>
            </span>
            <span className="mt-1 block text-[13px] tabular-nums text-[var(--proto-muted)]">
              {standing.rank === null
                ? "No score for this unit"
                : `Rank ${standing.rank} of ${standing.total}${
                    standing.percentile === null ? "" : ` · ${ordinal(standing.percentile)} percentile`
                  }`}
            </span>
            <PillarScale value={standing.value} median={standing.nationalMedian} cssVar={pillar.cssVar} />
          </button>
        );
      })}
    </div>
  );
}
