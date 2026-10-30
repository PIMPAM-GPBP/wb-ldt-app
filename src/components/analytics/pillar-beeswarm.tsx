"use client";

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { layoutSwarm, nearestDot, type SwarmDot } from "@/components/analytics/swarm-layout";
import { PILLARS, bandFor, formatScore, formatStanding, type PillarStanding } from "@/lib/analytics/derive";
import type { AdminLabels } from "@/lib/countries";

export type PillarBeeswarmProps = {
  standings: PillarStanding[];
  municipalityName: string;
  /** The selected unit's higher admin area, as it appears in the data. */
  province: string;
  adminLabels: AdminLabels;
  onSelect: (id: string) => void;
};

type Dot = SwarmDot<PillarStanding["distribution"][number]>;

const MIN_WIDTH = 260;
const SELECTED_R = 6;
const AXIS_TICKS = [0, 25, 50, 75, 100];
const MOUSE_REACH = 10;
const TOUCH_REACH = 16;
const TOOLTIP_HALF_WIDTH = 100;
const PAGE_STEP = 10;

/** Pick a text anchor that keeps a label of roughly this length inside the plot. */
function anchorFor(x: number, text: string, width: number) {
  const half = (text.length * 6.5) / 2 + 4;
  if (x - half < 0) return { x: 4, anchor: "start" as const };
  if (x + half > width) return { x: width - 4, anchor: "end" as const };
  return { x, anchor: "middle" as const };
}

function BeeswarmRow({
  standing,
  municipalityName,
  province,
  onSelect,
}: {
  standing: PillarStanding;
  municipalityName: string;
  province: string;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  const pillar = PILLARS.find((entry) => entry.id === standing.pillar) ?? PILLARS[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  const [hovered, setHovered] = useState<Dot | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

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
  const { dots } = swarm;
  const { value, nationalMedian, rank, total, band, scale } = standing;
  const standingOf = (dot: Dot) => formatStanding(bandFor(dot.value, scale), dot.rank, total).toLowerCase();

  const half = Math.ceil(Math.max(swarm.half, SELECTED_R + 4));
  const bandTop = 30;
  const cy = bandTop + half + 4;
  const axisY = cy + half + 10;
  const height = axisY + 26;

  const others = dots.filter((dot) => !dot.selected && dot.province !== province);
  const sameProvince = dots.filter((dot) => !dot.selected && dot.province === province);
  const selected = dots.find((dot) => dot.selected);
  const selectedLabel =
    selected && value !== null
      ? anchorFor(selected.x, `${municipalityName} ${formatScore(value, 1)}`, width)
      : null;

  const active = hovered ?? (cursor === null ? null : (dots[cursor] ?? null));
  const showTooltip = active !== null && !active.selected;
  const announcement =
    cursor !== null && dots[cursor]
      ? `${dots[cursor].label}, ${formatScore(dots[cursor].value, 1)}, ${standingOf(dots[cursor])}`
      : "";

  const summary =
    value === null || rank === null ? (
      <>{municipalityName} has no score.</>
    ) : (
      <>
        <span className="block font-medium text-ink">
          {municipalityName} {formatScore(value, 1)}
        </span>{" "}
        <span className="block">{formatStanding(band, rank, total)}</span>{" "}
        {nationalMedian === null ? null : <span className="block">Median {formatScore(nationalMedian, 1)}</span>}
      </>
    );

  function pointerAt(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const scale = width / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale - cy };
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "touch") return;
    const at = pointerAt(event);
    setHovered(at ? nearestDot(dots, at.x, at.y, MOUSE_REACH) : null);
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const at = pointerAt(event);
    if (!at) return;
    const pointerType = (event.nativeEvent as globalThis.PointerEvent).pointerType;
    const hit = nearestDot(dots, at.x, at.y, pointerType === "touch" ? TOUCH_REACH : MOUSE_REACH);
    if (hit) onSelect(hit.id);
  }

  function handleFocus(event: FocusEvent<SVGSVGElement>) {
    if (!event.currentTarget.matches(":focus-visible") || dots.length === 0) return;
    const start = dots.findIndex((dot) => dot.selected);
    setCursor(start === -1 ? Math.floor(dots.length / 2) : start);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (dots.length === 0) return;
    const last = dots.length - 1;
    const current = cursor ?? 0;
    const steps: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      PageUp: current + PAGE_STEP,
      PageDown: current - PAGE_STEP,
      Home: 0,
      End: last,
    };

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (cursor !== null) onSelect(dots[cursor].id);
      return;
    }
    if (!(event.key in steps)) return;
    event.preventDefault();
    setCursor(Math.min(last, Math.max(0, steps[event.key])));
  }

  return (
    <div className="grid gap-x-8 gap-y-2 border-t border-[var(--border-soft)] pt-5 first:border-t-0 first:pt-0 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div>
        <h3 id={`${id}-name`} className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: pillar.cssVar }} />
          {pillar.label}
        </h3>
        <p id={`${id}-summary`} className="mt-1 text-sm tabular-nums text-ink-muted">
          {summary}
        </p>
      </div>

      <div ref={containerRef} className="relative min-w-0">
        <svg
          ref={svgRef}
          role="group"
          aria-roledescription="beeswarm plot"
          aria-labelledby={`${id}-name ${id}-summary`}
          aria-describedby={`${id}-hint`}
          tabIndex={0}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block overflow-visible rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          style={{ cursor: hovered ? "pointer" : undefined }}
          onPointerMove={handleMove}
          onPointerLeave={() => setHovered(null)}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={() => setCursor(null)}
          onKeyDown={handleKeyDown}
        >
          <line x1={swarm.toX(0)} x2={swarm.toX(100)} y1={axisY} y2={axisY} className="stroke-[var(--border-strong)]" />
          {AXIS_TICKS.map((tick) => (
            <g key={tick}>
              <line x1={swarm.toX(tick)} x2={swarm.toX(tick)} y1={axisY} y2={axisY + 4} className="stroke-[var(--border-strong)]" />
              <text
                x={swarm.toX(tick)}
                y={axisY + 17}
                fontSize={12}
                textAnchor={tick === 0 ? "start" : tick === 100 ? "end" : "middle"}
                className="fill-ink-muted tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}

          <g aria-hidden="true">
            {nationalMedian === null ? null : (
              <line
                x1={swarm.toX(nationalMedian)}
                x2={swarm.toX(nationalMedian)}
                y1={bandTop}
                y2={axisY}
                strokeWidth={1.5}
                className="stroke-ink"
                strokeOpacity={0.55}
              />
            )}
            <g className="fill-ink-muted" fillOpacity={0.4}>
              {others.map((dot) => (
                <circle key={dot.id} cx={dot.x} cy={cy + dot.y} r={swarm.radius} />
              ))}
            </g>
            <g style={{ fill: pillar.cssVar }} fillOpacity={0.8}>
              {sameProvince.map((dot) => (
                <circle key={dot.id} cx={dot.x} cy={cy + dot.y} r={swarm.radius} />
              ))}
            </g>

            {selected ? (
              <>
                <line x1={selected.x} x2={selected.x} y1={20} y2={cy + selected.y - SELECTED_R} className="stroke-ink" />
                <circle
                  cx={selected.x}
                  cy={cy + selected.y}
                  r={SELECTED_R}
                  strokeWidth={1.5}
                  className="stroke-ink"
                  style={{ fill: pillar.cssVar }}
                />
              </>
            ) : null}
            {selected && selectedLabel ? (
              <text x={selectedLabel.x} y={14} fontSize={12} textAnchor={selectedLabel.anchor} className="fill-ink tabular-nums">
                <tspan fontWeight={600}>{municipalityName}</tspan>
                <tspan> {formatScore(value, 1)}</tspan>
              </text>
            ) : null}

            {active ? (
              <circle
                cx={active.x}
                cy={cy + active.y}
                r={Math.max(swarm.radius, 3) + 3}
                fill="none"
                strokeWidth={1.5}
                className="stroke-ink"
              />
            ) : null}
          </g>
        </svg>

        {showTooltip ? (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[12.5rem] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-sm text-ink shadow-float"
            style={{
              left: Math.min(width - TOOLTIP_HALF_WIDTH, Math.max(TOOLTIP_HALF_WIDTH, active.x)),
              top: cy + active.y - Math.max(swarm.radius, 3) - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <span className="block font-medium">{active.label}</span>
            <span className="block tabular-nums">
              {formatScore(active.value, 1)}, {standingOf(active)}
            </span>
            <span className="block text-ink-muted">{active.province}</span>
          </div>
        ) : null}

        <p id={`${id}-hint`} className="sr-only">
          Arrow keys move between places by score, Page Up and Page Down move ten at a time, Enter selects.
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}

function LegendSwatch({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-3 items-center gap-0.5">{children}</span>;
}

/**
 * One row per pillar with every unit's score as a dot, so outliers show without picking axes.
 * The selected unit is ringed and named, and dots in its higher admin area carry the pillar color.
 */
export function PillarBeeswarm({ standings, municipalityName, province, adminLabels, onSelect }: PillarBeeswarmProps) {
  const lowerPlural = adminLabels.lower.plural.toLowerCase();

  return (
    <div>
      <div className="flex flex-col gap-5">
        {standings.map((standing) => (
          <BeeswarmRow
            key={standing.pillar}
            standing={standing}
            municipalityName={municipalityName}
            province={province}
            onSelect={onSelect}
          />
        ))}
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
        <li className="flex items-center gap-2">
          <LegendSwatch>
            <span aria-hidden="true" className="size-3 rounded-full border-[1.5px] border-ink bg-ink-muted" />
          </LegendSwatch>
          {municipalityName}
        </li>
        <li className="flex items-center gap-2">
          <LegendSwatch>
            {PILLARS.map((pillar) => (
              <span key={pillar.id} aria-hidden="true" className="size-2 rounded-full opacity-80" style={{ background: pillar.cssVar }} />
            ))}
          </LegendSwatch>
          In {province}
        </li>
        <li className="flex items-center gap-2">
          <LegendSwatch>
            <span aria-hidden="true" className="size-2 rounded-full bg-ink-muted opacity-40" />
          </LegendSwatch>
          Other {lowerPlural}
        </li>
        <li className="flex items-center gap-2">
          <LegendSwatch>
            <span aria-hidden="true" className="h-3 w-0 border-l-[1.5px] border-ink opacity-55" />
          </LegendSwatch>
          Median
        </li>
      </ul>
    </div>
  );
}
