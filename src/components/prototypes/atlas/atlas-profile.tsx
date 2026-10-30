"use client";

import { memo, useMemo } from "react";

import type { Country } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { AnalyticsPageData, ScoreWaterfallGroup } from "@/types/analytics";

import { PILLARS, formatDelta, formatScore, getPillarStandings, type PillarStanding } from "../shared/derive";

export const PANEL_LABEL = "text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--proto-muted)]";

const FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--proto-link)]";

const pillarMeta = (standing: PillarStanding) => PILLARS.find((pillar) => pillar.id === standing.pillar)!;

function Triangle({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 8" className="size-2 shrink-0">
      <path d={up ? "M4 1 L7.5 7 H0.5 Z" : "M4 7 L7.5 1 H0.5 Z"} fill="currentColor" />
    </svg>
  );
}

/** Signed difference with a triangle, so direction never depends on color alone. */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--proto-muted)]">n/a</span>;
  if (Number(Math.abs(value).toFixed(1)) === 0) {
    return <span className="tabular-nums text-[var(--proto-muted)]">0.0</span>;
  }
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        up ? "text-[var(--proto-above)]" : "text-[var(--proto-below)]",
      )}
    >
      <Triangle up={up} />
      {formatDelta(value, 1)}
    </span>
  );
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Every unit's score as a thin tick on a 0 to 100 axis. Ticks overlap into a density band.
 * The national median is a tall solid tick, the province median a tall dashed tick,
 * and the selected unit a pillar-colored dot.
 */
const DistributionStrip = memo(function DistributionStrip({
  standing,
  color,
}: {
  standing: PillarStanding;
  color: string;
}) {
  const { distribution, value, nationalMedian, provinceMedian } = standing;
  return (
    <svg aria-hidden="true" width="100%" height="16" className="block overflow-visible">
      <line x1="0" x2="100%" y1="8" y2="8" strokeWidth="1" style={{ stroke: "var(--proto-rule)" }} />
      {distribution.map((entry) => (
        <line
          key={entry.id}
          x1={`${clampPercent(entry.value)}%`}
          x2={`${clampPercent(entry.value)}%`}
          y1="5"
          y2="11"
          strokeWidth="1"
          style={{ stroke: "var(--proto-rule-strong)" }}
        />
      ))}
      {nationalMedian !== null ? (
        <line
          x1={`${clampPercent(nationalMedian)}%`}
          x2={`${clampPercent(nationalMedian)}%`}
          y1="1"
          y2="15"
          strokeWidth="1.5"
          style={{ stroke: "var(--proto-ink)" }}
        />
      ) : null}
      {provinceMedian !== null ? (
        <line
          x1={`${clampPercent(provinceMedian)}%`}
          x2={`${clampPercent(provinceMedian)}%`}
          y1="1"
          y2="15"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          style={{ stroke: "var(--proto-ink)" }}
        />
      ) : null}
      {value !== null ? (
        <circle
          cx={`${clampPercent(value)}%`}
          cy="8"
          r="4.5"
          strokeWidth="1.5"
          style={{ fill: color, stroke: "var(--proto-surface)" }}
        />
      ) : null}
    </svg>
  );
});

function PillarRow({
  standing,
  active,
  mapped,
  onSelect,
}: {
  standing: PillarStanding;
  /** The drivers below belong to this pillar. */
  active: boolean;
  /** This pillar's composite score is the map metric. */
  mapped: boolean;
  onSelect: () => void;
}) {
  const meta = pillarMeta(standing);
  return (
    <li>
      <button
        type="button"
        aria-current={mapped ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "relative block w-full px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--proto-surface-sunken)]",
          active && "bg-[var(--proto-surface-sunken)]",
          FOCUS,
        )}
      >
        {active ? (
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: meta.cssVar }} />
        ) : null}
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--proto-ink)]">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.cssVar }} />
              {meta.label}
              {mapped ? <span className="text-[11px] font-normal text-[var(--proto-muted)]">On map</span> : null}
            </span>
            <span className="mt-0.5 block text-xs tabular-nums text-[var(--proto-muted)]">
              {standing.rank === null ? "No rank" : `Rank ${standing.rank} of ${standing.total}`}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-heading text-2xl font-semibold leading-none tabular-nums text-[var(--proto-ink)]">
              {formatScore(standing.value, 1)}
            </span>
            <span className="mt-1.5 block text-xs text-[var(--proto-muted)]">
              <Delta value={standing.delta} /> vs national
            </span>
          </span>
        </span>
        <span className="mt-2.5 block">
          <DistributionStrip standing={standing} color={meta.cssVar} />
        </span>
        <span className="sr-only">
          National median {formatScore(standing.nationalMedian, 1)}. Province median{" "}
          {formatScore(standing.provinceMedian, 1)}.
        </span>
      </button>
    </li>
  );
}

function KeyGlyph({ kind }: { kind: "tick" | "national" | "province" | "unit" }) {
  return (
    <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12" className="shrink-0">
      {kind === "tick" ? (
        <line x1="5" x2="5" y1="3" y2="9" strokeWidth="1" style={{ stroke: "var(--proto-rule-strong)" }} />
      ) : null}
      {kind === "national" ? (
        <line x1="5" x2="5" y1="0" y2="12" strokeWidth="1.5" style={{ stroke: "var(--proto-ink)" }} />
      ) : null}
      {kind === "province" ? (
        <line
          x1="5"
          x2="5"
          y1="0"
          y2="12"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          style={{ stroke: "var(--proto-ink)" }}
        />
      ) : null}
      {kind === "unit" ? <circle cx="5" cy="6" r="3.5" style={{ fill: "var(--proto-muted)" }} /> : null}
    </svg>
  );
}

function Drivers({ group, standing }: { group: ScoreWaterfallGroup; standing: PillarStanding }) {
  const measured = group.rows
    .filter((row): row is typeof row & { contribution: number } => row.contribution !== null)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const missing = group.rows.filter((row) => row.contribution === null);
  const largest = Math.max(...measured.map((row) => Math.abs(row.contribution)), 0) || 1;
  const meta = pillarMeta(standing);

  return (
    <>
      <p className="mt-1.5 text-xs text-[var(--proto-muted)]">
        {meta.label}, in points against the national average
      </p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_96px_44px] gap-x-2" aria-hidden="true">
        <span />
        <span className="flex justify-between text-[11px] text-[var(--proto-muted)]">
          <span>Below</span>
          <span>Above</span>
        </span>
        <span />
      </div>
      <ul className="mt-1">
        {measured.map((row) => {
          const share = (Math.abs(row.contribution) / largest) * 50;
          const above = row.contribution > 0;
          return (
            <li
              key={row.componentId}
              title={`${row.label}: ${formatScore(row.municipalityValue, 1)} here, ${formatScore(row.nationalValue, 1)} national`}
              className="grid min-h-8 grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-x-2 py-1"
            >
              <span className="text-[13px] leading-snug text-[var(--proto-ink)]">
                {row.label.replace(/ Score$/, "")}
              </span>
              <span aria-hidden="true" className="relative block h-3">
                <span className="absolute inset-y-[-2px] left-1/2 w-px bg-[var(--proto-rule-strong)]" />
                {Number(Math.abs(row.contribution).toFixed(1)) === 0 ? null : (
                  <span
                    className={cn(
                      "absolute inset-y-0 min-w-0.5",
                      above ? "left-1/2 bg-[var(--proto-above)]" : "right-1/2 bg-[var(--proto-below)]",
                    )}
                    style={{ width: `${share}%` }}
                  />
                )}
              </span>
              <span className="text-right text-[13px] tabular-nums text-[var(--proto-ink)]">
                {formatDelta(row.contribution, 1)}
              </span>
            </li>
          );
        })}
        {missing.map((row) => (
          <li
            key={row.componentId}
            className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 py-1"
          >
            <span className="text-[13px] leading-snug text-[var(--proto-muted)]">
              {row.label.replace(/ Score$/, "")}
            </span>
            <span className="text-right text-xs text-[var(--proto-muted)]">No data</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-[var(--proto-rule)] pt-3 text-sm text-[var(--proto-ink)]">
        <span className="font-heading font-semibold tabular-nums">{formatScore(group.municipalityScore, 1)}</span>
        {" vs "}
        <span className="tabular-nums">{formatScore(group.nationalScore, 1)}</span>
        {" national, "}
        <Delta value={group.totalDifference} />
      </p>
    </>
  );
}

export type AtlasProfileProps = {
  data: AnalyticsPageData;
  country: Country;
  /** Sets the map metric, used when a pillar row is clicked. */
  onSelectMetric: (metricId: string) => void;
  isPending: boolean;
};

export function AtlasProfile({ data, country, onSelectMetric, isPending }: AtlasProfileProps) {
  const standings = useMemo(() => getPillarStandings(data), [data]);
  const activePillar = data.map.metric.pillar ?? "prosperity";
  const activeStanding = standings.find((standing) => standing.pillar === activePillar) ?? standings[0];
  const group = data.waterfalls.find((entry) => entry.scoreId === activeStanding.scoreId);

  const { municipality: unit, district, province, context } = data.municipality;
  const middleLabel = country.adminLabels.middle?.singular.toLowerCase();
  const population = context.population === null ? null : Math.round(context.population).toLocaleString("en-US");
  const meta = [
    district && middleLabel ? `${district} ${middleLabel}` : null,
    province ? `${province} ${country.adminLabels.higher.singular.toLowerCase()}` : null,
    population ? `${population} people` : null,
  ].filter((part): part is string => part !== null);

  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        isPending && "opacity-60",
      )}
    >
      <div className="px-4 pb-4 pt-4">
        <h2 className="break-words font-heading text-2xl font-semibold leading-tight text-[var(--proto-ink)]">{unit}</h2>
        {meta.length > 0 ? (
          <p className="mt-1 text-[13px] leading-snug tabular-nums text-[var(--proto-muted)]">{meta.join(" · ")}</p>
        ) : null}
      </div>

      <section aria-labelledby="atlas-scores" className="border-t border-[var(--proto-rule)] pt-4">
        <h3 id="atlas-scores" className={cn(PANEL_LABEL, "px-4")}>
          Scores
        </h3>
        <ul className="mt-2">
          {standings.map((standing) => (
            <PillarRow
              key={standing.pillar}
              standing={standing}
              active={standing.pillar === activeStanding.pillar}
              mapped={standing.scoreId === data.selected.metricId}
              onSelect={() => {
                if (standing.scoreId !== data.selected.metricId) onSelectMetric(standing.scoreId);
              }}
            />
          ))}
        </ul>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-4 pt-2 text-[11px] text-[var(--proto-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <KeyGlyph kind="tick" />
            Each {country.adminLabels.lower.singular.toLowerCase()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyGlyph kind="national" />
            National median
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyGlyph kind="province" />
            {province} median
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyGlyph kind="unit" />
            {unit}
          </span>
        </p>
      </section>

      <section aria-labelledby="atlas-drivers" className="border-t border-[var(--proto-rule)] px-4 pb-5 pt-4">
        <h3 id="atlas-drivers" className={PANEL_LABEL}>
          Drivers
        </h3>
        {group ? (
          <Drivers group={group} standing={activeStanding} />
        ) : (
          <p className="mt-2 text-sm text-[var(--proto-muted)]">No component breakdown for this score.</p>
        )}
      </section>
    </div>
  );
}
