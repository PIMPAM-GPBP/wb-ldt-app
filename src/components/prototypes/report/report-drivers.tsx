"use client";

import { Fragment, useId, useState } from "react";

import type { AdminLabels } from "@/lib/countries";
import type { ScoreWaterfallGroup, ScoreWaterfallRow } from "@/types/analytics";

import { formatDelta, formatScore } from "../shared/derive";

export type ReportDriversProps = {
  /** The waterfall group for the active pillar score, or null when none matches. */
  group: ScoreWaterfallGroup | null;
  adminLabels: AdminLabels;
  municipalityName: string;
};

const HEAD_CELL =
  "border-b border-[var(--proto-rule-strong)] px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--proto-muted)] first:pl-0 last:pr-0";
const BODY_CELL = "border-t border-[var(--proto-rule)] px-3 py-3 align-top first:pl-0 last:pr-0";
const TOTAL_CELL = "border-t border-[var(--proto-rule-strong)] px-3 pt-3 align-top first:pl-0 last:pr-0";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";

function signTone(value: number | null) {
  if (value === null || value === 0) return "text-[var(--proto-ink)]";
  return value > 0 ? "text-[var(--proto-above)]" : "text-[var(--proto-below)]";
}

/** Largest absolute contribution first. Rows without a contribution go last. */
function sortByImpact(rows: ScoreWaterfallRow[]) {
  return [...rows].sort((a, b) => {
    if (a.contribution === null || b.contribution === null) {
      return Number(a.contribution === null) - Number(b.contribution === null);
    }
    return Math.abs(b.contribution) - Math.abs(a.contribution);
  });
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 text-[var(--proto-muted)] ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Signed value beside a diverging bar. Right of the zero line is above the national score, left is below. */
function Contribution({ value, scale }: { value: number | null; scale: number }) {
  return (
    <div className="flex items-center justify-end gap-2 sm:gap-3">
      {value === null ? (
        <span className="flex h-4 w-16 shrink-0 items-center justify-end text-[var(--proto-muted)] sm:w-[120px]">
          No data
        </span>
      ) : (
        <div aria-hidden="true" className="relative h-4 w-16 shrink-0 sm:w-[120px]">
          <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--proto-rule-strong)]" />
          {value === 0 ? null : (
            <div
              className={`absolute inset-y-1 ${value > 0 ? "left-1/2 bg-[var(--proto-above)]" : "right-1/2 bg-[var(--proto-below)]"}`}
              style={{ width: `${Math.max((Math.abs(value) / scale) * 50, 1)}%` }}
            />
          )}
        </div>
      )}
      <span className={`w-12 shrink-0 text-right font-medium tabular-nums ${signTone(value)}`}>
        {value === null ? null : formatDelta(value, 1)}
      </span>
    </div>
  );
}

type DriversTableProps = {
  group: ScoreWaterfallGroup;
  adminLabels: AdminLabels;
  municipalityName: string;
};

function DriversTable({ group, adminLabels, municipalityName }: DriversTableProps) {
  const idBase = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const rows = sortByImpact(group.rows);
  const largest = Math.max(
    0,
    ...group.rows.flatMap((row) => (row.contribution === null ? [] : [Math.abs(row.contribution)])),
  );
  const scale = largest > 0 ? largest : 1;
  const lower = adminLabels.lower.singular.toLowerCase();

  function toggle(componentId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(componentId)) next.delete(componentId);
      else next.add(componentId);
      return next;
    });
  }

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Components of {group.scoreLabel} for {municipalityName}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${HEAD_CELL} text-left`}>
            Component
          </th>
          <th scope="col" className={`${HEAD_CELL} text-right`}>
            This {lower}
          </th>
          <th scope="col" className={`${HEAD_CELL} hidden text-right sm:table-cell`}>
            National
          </th>
          <th scope="col" className={`${HEAD_CELL} text-right`}>
            Contribution
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const open = expanded.has(row.componentId);
          const detailId = `${idBase}-${row.componentId}`;
          return (
            <Fragment key={row.componentId}>
              <tr>
                <th scope="row" className={`${BODY_CELL} text-left font-normal`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={detailId}
                    onClick={() => toggle(row.componentId)}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--proto-radius-control)] text-left text-[var(--proto-ink)] md:min-h-0 ${FOCUS_RING}`}
                  >
                    {row.label}
                    <Chevron open={open} />
                  </button>
                </th>
                <td className={`${BODY_CELL} text-right tabular-nums`}>
                  {formatScore(row.municipalityValue, 1)}
                </td>
                <td className={`${BODY_CELL} hidden text-right tabular-nums sm:table-cell`}>
                  {formatScore(row.nationalValue, 1)}
                </td>
                <td className={`${BODY_CELL} text-right`}>
                  <Contribution value={row.contribution} scale={scale} />
                </td>
              </tr>
              <tr id={detailId} hidden={!open}>
                <td colSpan={4} className="pb-3 text-sm leading-6 text-[var(--proto-muted)]">
                  {row.description ?? "No description available."}
                </td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className={`${TOTAL_CELL} text-left font-medium`}>
            Total difference from national
            <span className="block pt-1 text-sm font-normal tabular-nums text-[var(--proto-muted)]">
              {formatScore(group.municipalityScore, 1)} vs {formatScore(group.nationalScore, 1)}
            </span>
          </th>
          <td className={TOTAL_CELL} />
          <td className={`${TOTAL_CELL} hidden sm:table-cell`} />
          <td className={`${TOTAL_CELL} text-right`}>
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <span aria-hidden="true" className="w-16 shrink-0 sm:w-[120px]" />
              <span className={`w-12 shrink-0 text-right font-medium tabular-nums ${signTone(group.totalDifference)}`}>
                {formatDelta(group.totalDifference, 1)}
              </span>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export function ReportDrivers({ group, adminLabels, municipalityName }: ReportDriversProps) {
  if (group === null) {
    return <p className="text-sm text-[var(--proto-muted)]">No component breakdown for this measure.</p>;
  }
  // Keyed by score so open descriptions reset when the metric changes.
  return (
    <DriversTable
      key={group.scoreId}
      group={group}
      adminLabels={adminLabels}
      municipalityName={municipalityName}
    />
  );
}
