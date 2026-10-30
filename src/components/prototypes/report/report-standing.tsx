"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { AdminLabels } from "@/lib/countries";

import { formatScore, type PillarStanding } from "../shared/derive";
import { ReportDelta } from "./report-delta";
import { formatCount, ordinal } from "./report-format";

export type ReportStandingProps = {
  standing: PillarStanding;
  /** `var(--pillar-...)` for the active pillar. */
  pillarCssVar: string;
  municipalityName: string;
  /** Name of the selected unit's higher-level region, as it appears in the data. */
  province: string;
  adminLabels: AdminLabels;
};

const PAD = 12;
const MIN_WIDTH = 260;
const MAX_BAND = 150;
const RADII = [3, 2.5, 2, 1.6, 1.25];
const SELECTED_R = 6;
const AXIS_TICKS = [0, 20, 40, 60, 80, 100];

/**
 * Beeswarm placement: x is fixed by the score, y is the smallest offset from the center line
 * that keeps every dot at least one diameter from the dots already placed. Points must be sorted by x.
 */
function placeSwarm(xs: number[], radius: number) {
  const gap = radius * 2 + 0.6;
  const gapSquared = gap * gap - 0.01;
  const ys = new Array<number>(xs.length).fill(0);
  let start = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    while (start < i && x - xs[start] >= gap) start += 1;
    const isFree = (y: number) => {
      for (let j = start; j < i; j += 1) {
        const dx = x - xs[j];
        const dy = y - ys[j];
        if (dx * dx + dy * dy < gapSquared) return false;
      }
      return true;
    };

    if (isFree(0)) continue;
    const candidates: number[] = [];
    for (let j = start; j < i; j += 1) {
      const dx = x - xs[j];
      const dy = Math.sqrt(Math.max(0, gap * gap - dx * dx));
      candidates.push(ys[j] + dy, ys[j] - dy);
    }
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
    ys[i] = candidates.find(isFree) ?? candidates[candidates.length - 1];
  }
  return ys;
}

function layoutSwarm(points: PillarStanding["distribution"], width: number) {
  const toX = (value: number) => PAD + (Math.min(100, Math.max(0, value)) / 100) * (width - PAD * 2);
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const xs = sorted.map((point) => toX(point.value));

  let radius = RADII[RADII.length - 1];
  let ys: number[] = [];
  let extent = 0;
  for (const candidate of RADII) {
    radius = candidate;
    ys = placeSwarm(xs, candidate);
    extent = ys.reduce((max, y) => Math.max(max, Math.abs(y)), 0);
    if ((extent + candidate) * 2 <= MAX_BAND) break;
  }

  const dots = sorted.map((point, index) => ({
    id: point.id,
    province: point.province,
    selected: point.selected,
    x: Math.round(xs[index] * 100) / 100,
    y: Math.round(ys[index] * 100) / 100,
  }));
  return { dots, radius, half: extent + radius, toX };
}

/** Pick a text anchor that keeps a label of roughly this length inside the plot. */
function anchorFor(x: number, text: string, width: number) {
  const half = (text.length * 6.5) / 2 + 4;
  if (x - half < 0) return { x: 4, anchor: "start" as const };
  if (x + half > width) return { x: width - 4, anchor: "end" as const };
  return { x, anchor: "middle" as const };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-l border-[var(--proto-rule)] py-4 pl-4 pr-2 first:border-l-0 first:pl-0">
      <dt className="text-[13px] leading-tight text-[var(--proto-muted)]">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[var(--proto-ink)]">{children}</dd>
    </div>
  );
}

/**
 * One dot per unit on a 0 to 100 axis for the active pillar score, with the national and
 * province medians marked, the selected unit named, and its rank, percentile and gap in text.
 */
export function ReportStanding({ standing, pillarCssVar, municipalityName, province, adminLabels }: ReportStandingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const swarm = useMemo(() => layoutSwarm(standing.distribution, width), [standing.distribution, width]);

  const { value, nationalMedian, provinceMedian, rank, total, percentile } = standing;
  const lowerPlural = adminLabels.lower.plural.toLowerCase();
  const higherSingular = adminLabels.higher.singular.toLowerCase();
  const provinceGap = value !== null && provinceMedian !== null ? value - provinceMedian : null;

  const half = Math.ceil(Math.max(swarm.half, 24));
  const bandTop = 30;
  const cy = bandTop + half + 4;
  const axisY = cy + half + 12;
  const height = axisY + 62;

  const others = swarm.dots.filter((dot) => !dot.selected && dot.province !== province);
  const sameProvince = swarm.dots.filter((dot) => !dot.selected && dot.province === province);
  const selected = swarm.dots.find((dot) => dot.selected);

  const nationalText = nationalMedian === null ? null : `National median ${formatScore(nationalMedian, 1)}`;
  const provinceText = provinceMedian === null ? null : `${province} median ${formatScore(provinceMedian, 1)}`;
  const selectedText = value === null ? null : `${municipalityName} ${formatScore(value, 1)}`;

  const summary = [
    `${standing.label} for ${total} ${lowerPlural} on a 0 to 100 scale.`,
    nationalText ? `${nationalText}.` : null,
    provinceText ? `${provinceText}.` : null,
    value !== null && rank !== null
      ? `${municipalityName} scores ${formatScore(value, 1)}, rank ${rank} of ${total}.`
      : `${municipalityName} has no score.`,
  ]
    .filter(Boolean)
    .join(" ");

  const nationalLabel = nationalText && nationalMedian !== null ? anchorFor(swarm.toX(nationalMedian), nationalText, width) : null;
  const provinceLabel = provinceText && provinceMedian !== null ? anchorFor(swarm.toX(provinceMedian), provinceText, width) : null;
  const selectedLabel = selected && selectedText ? anchorFor(selected.x, selectedText, width) : null;

  return (
    <div>
      <p className="text-sm text-[var(--proto-muted)]">
        {standing.label} for each of {formatCount(total)} {lowerPlural}, 0 to 100.
      </p>

      <div ref={containerRef} className="mt-4">
        <svg role="img" aria-label={summary} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
          <line x1={PAD} x2={width - PAD} y1={axisY} y2={axisY} className="stroke-[var(--proto-rule-strong)]" />
          {AXIS_TICKS.map((tick) => (
            <g key={tick}>
              <line x1={swarm.toX(tick)} x2={swarm.toX(tick)} y1={axisY} y2={axisY + 4} className="stroke-[var(--proto-rule-strong)]" />
              <text
                x={swarm.toX(tick)}
                y={axisY + 17}
                fontSize={12}
                textAnchor={tick === 0 ? "start" : tick === 100 ? "end" : "middle"}
                className="fill-[var(--proto-muted)] tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}

          <g className="fill-[var(--proto-muted)]" fillOpacity={0.4}>
            {others.map((dot) => (
              <circle key={dot.id} cx={dot.x} cy={cy + dot.y} r={swarm.radius} />
            ))}
          </g>
          <g style={{ fill: pillarCssVar }} fillOpacity={0.75}>
            {sameProvince.map((dot) => (
              <circle key={dot.id} cx={dot.x} cy={cy + dot.y} r={swarm.radius} />
            ))}
          </g>

          {nationalMedian !== null ? (
            <line
              x1={swarm.toX(nationalMedian)}
              x2={swarm.toX(nationalMedian)}
              y1={bandTop}
              y2={axisY + 26}
              strokeWidth={1.5}
              className="stroke-[var(--proto-ink)]"
            />
          ) : null}
          {provinceMedian !== null ? (
            <line
              x1={swarm.toX(provinceMedian)}
              x2={swarm.toX(provinceMedian)}
              y1={bandTop}
              y2={axisY + 44}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              className="stroke-[var(--proto-ink)]"
            />
          ) : null}

          {selected ? (
            <g>
              <line x1={selected.x} x2={selected.x} y1={20} y2={cy + selected.y - SELECTED_R} className="stroke-[var(--proto-ink)]" />
              <circle
                cx={selected.x}
                cy={cy + selected.y}
                r={SELECTED_R}
                strokeWidth={1.5}
                className="stroke-[var(--proto-ink)]"
                style={{ fill: pillarCssVar }}
              />
            </g>
          ) : null}

          {selectedLabel && selected ? (
            <text x={selectedLabel.x} y={14} fontSize={12} textAnchor={selectedLabel.anchor} className="fill-[var(--proto-ink)] tabular-nums">
              <tspan fontWeight={600}>{municipalityName}</tspan>
              <tspan> {formatScore(value, 1)}</tspan>
            </text>
          ) : null}
          {nationalLabel && nationalText ? (
            <text x={nationalLabel.x} y={axisY + 38} fontSize={12} textAnchor={nationalLabel.anchor} className="fill-[var(--proto-ink)] tabular-nums">
              {nationalText}
            </text>
          ) : null}
          {provinceLabel && provinceText ? (
            <text x={provinceLabel.x} y={axisY + 56} fontSize={12} textAnchor={provinceLabel.anchor} className="fill-[var(--proto-ink)] tabular-nums">
              {provinceText}
            </text>
          ) : null}
        </svg>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--proto-muted)]">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full border-[1.5px] border-[var(--proto-ink)]" style={{ background: pillarCssVar }} />
          {municipalityName}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full opacity-75" style={{ background: pillarCssVar }} />
          Same {higherSingular}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--proto-muted)] opacity-40" />
          Other {lowerPlural}
        </li>
      </ul>

      <dl className="mt-5 grid grid-cols-3 border-t border-[var(--proto-rule)]">
        <Fact label="Rank">
          {rank === null ? (
            "n/a"
          ) : (
            <>
              {rank}
              <span className="ml-1 text-sm font-normal text-[var(--proto-muted)]">of {formatCount(total)}</span>
            </>
          )}
        </Fact>
        <Fact label="Percentile">{percentile === null ? "n/a" : ordinal(percentile)}</Fact>
        <Fact label={`vs ${province} median`}>
          <ReportDelta value={provinceGap} />
        </Fact>
      </dl>
    </div>
  );
}
