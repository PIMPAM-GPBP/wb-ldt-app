"use client";

import { useId, useState } from "react";

import type { AdminLabels } from "@/lib/countries";
import type { ScoreWaterfallGroup, ScoreWaterfallRow } from "@/types/analytics";

import { formatDelta, formatScore } from "../shared/derive";

export type MinimalDriversProps = {
  groups: ScoreWaterfallGroup[];
  municipalityName: string;
  adminLabels: AdminLabels;
};

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";

export function MinimalDrivers({ groups, municipalityName }: MinimalDriversProps) {
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-3">
      {groups.map((group) => (
        <DriverGroup key={group.scoreId} group={group} municipalityName={municipalityName} />
      ))}
    </div>
  );
}

function DriverGroup({ group, municipalityName }: { group: ScoreWaterfallGroup; municipalityName: string }) {
  const headingId = useId();
  const axisExtent = axisExtentFor(group);

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 border-t border-[var(--proto-rule)] py-6 first:border-t-0 first:pt-0 2xl:border-t-0 2xl:border-l 2xl:px-6 2xl:py-0 2xl:first:border-l-0 2xl:first:pl-0"
    >
      <h3 id={headingId} className="font-heading text-lg font-semibold leading-snug text-[var(--proto-ink)]">
        {group.scoreLabel}
      </h3>
      <p className="mt-1.5 text-sm tabular-nums text-[var(--proto-muted)]">
        {municipalityName}{" "}
        <span className="font-heading font-semibold text-[var(--proto-ink)]">
          {formatScore(group.municipalityScore, 1)}
        </span>{" "}
        · national {formatScore(group.nationalScore, 1)} · {formatDelta(group.totalDifference, 1)}
      </p>

      <ul className="mt-5 flex flex-col gap-4">
        {sortByImpact(group.rows).map((row) => (
          <DriverRow key={row.componentId} row={row} axisExtent={axisExtent} />
        ))}
      </ul>
    </section>
  );
}

function DriverRow({ row, axisExtent }: { row: ScoreWaterfallRow; axisExtent: number }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const { contribution } = row;

  const width = contribution ? Math.max((Math.abs(contribution) / axisExtent) * 50, 1.5) : 0;
  const barStyle =
    contribution && contribution > 0
      ? { left: "50%", width: `${width}%` }
      : { left: `${50 - width}%`, width: `${width}%` };

  return (
    <li>
      <div className="flex items-baseline justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={descriptionId}
          onClick={() => setOpen((value) => !value)}
          className={`min-h-9 text-left text-sm text-[var(--proto-ink)] underline decoration-dotted decoration-[var(--proto-muted)] underline-offset-4 hover:decoration-[var(--proto-ink)] max-md:min-h-11 ${FOCUS_RING}`}
        >
          {row.label.replace(/ Score$/, "")}
        </button>
        <span className="shrink-0 text-sm tabular-nums text-[var(--proto-ink)]">
          {contribution === null ? "No data" : formatDelta(contribution, 1)}
        </span>
      </div>

      <div aria-hidden="true" className="relative mt-1.5 h-4">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--proto-rule-strong)]" />
        {contribution ? (
          <span
            className={`absolute inset-y-1 ${contribution > 0 ? "bg-[var(--proto-above)]" : "bg-[var(--proto-below)]"}`}
            style={barStyle}
          />
        ) : null}
      </div>

      <p id={descriptionId} hidden={!open} className="mt-2 text-sm leading-6 text-[var(--proto-muted)]">
        {row.description ?? "No description available."}
      </p>
    </li>
  );
}

/**
 * Same scale as score-waterfall-section.tsx: half a track is the largest absolute
 * contribution or total gap, with 20 percent headroom and a one-point floor.
 */
function axisExtentFor(group: ScoreWaterfallGroup) {
  const magnitudes = group.rows.flatMap((row) =>
    row.contribution === null ? [] : [Math.abs(row.contribution)],
  );
  return Math.max(...magnitudes, Math.abs(group.totalDifference ?? 0), 1) * 1.2;
}

/** Largest absolute contribution first, rows without a contribution last. */
function sortByImpact(rows: ScoreWaterfallRow[]) {
  return [...rows].sort((a, b) => {
    if (a.contribution === null || b.contribution === null) {
      return Number(a.contribution === null) - Number(b.contribution === null);
    }
    return Math.abs(b.contribution) - Math.abs(a.contribution);
  });
}
