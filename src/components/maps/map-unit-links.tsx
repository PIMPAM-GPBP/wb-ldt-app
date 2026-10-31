"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { PILLARS } from "@/lib/analytics/derive";

/** A country's admin level names, singular; `middle` is null where the country has two levels. */
export type MapUnitLabels = { lower: string; middle: string | null; higher: string };

type HoveredUnit = { key: string; name: string; middle: string | null; higher: string; scores: string[] };

const POINTER_GAP = 14;

/** Reads the names and scores the server wrote on a unit's path; see CountryLandingPage. */
function readUnit(path: Element, key: string): HoveredUnit {
  return {
    key,
    name: path.getAttribute("data-n") ?? "",
    middle: path.getAttribute("data-m"),
    higher: path.getAttribute("data-h") ?? "",
    scores: (path.getAttribute("data-s") ?? "").split("|"),
  };
}

/**
 * Opens the clicked unit of a server-rendered map in the workspace, and names it in a card that
 * follows a mouse or pen. One handler on the wrapper replaces a link per unit, which on Nepal's
 * 751 units more than halved the page. The map is a pointer shortcut; the ranked lists beside it
 * are the keyboard route to the same pages, so the card is hidden from assistive technology.
 */
export function MapUnitLinks({ hrefBase, year, labels, children }: { hrefBase: string; year: number; labels: MapUnitLabels; children: ReactNode }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [unit, setUnit] = useState<HoveredUnit | null>(null);

  // Beside the pointer, flipped to the other side near the map's right or bottom edge.
  const place = () => {
    const wrapper = wrapperRef.current;
    const card = cardRef.current;
    if (!wrapper || !card) return;
    const { x, y } = pointer.current;
    const left = x + POINTER_GAP + card.offsetWidth > wrapper.clientWidth ? x - POINTER_GAP - card.offsetWidth : x + POINTER_GAP;
    const top = y + POINTER_GAP + card.offsetHeight > wrapper.clientHeight ? y - POINTER_GAP - card.offsetHeight : y + POINTER_GAP;
    card.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`;
  };

  // The card's size changes with its text, so place it again once a new unit has rendered.
  useLayoutEffect(place, [unit]);

  return (
    <div
      ref={wrapperRef}
      className="relative [&_path[data-k]]:cursor-pointer [&_path[data-k]:hover]:opacity-80"
      onClick={(event) => {
        const key = (event.target as Element).closest("[data-k]")?.getAttribute("data-k");
        if (key) router.push(`${hrefBase}${encodeURIComponent(key)}`);
      }}
      onPointerMove={(event) => {
        // A tap opens the unit; a card would only flash under the finger first.
        if (event.pointerType === "touch") return;
        const path = (event.target as Element).closest("[data-k]");
        const key = path?.getAttribute("data-k");
        if (!path || !key) {
          setUnit(null);
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        pointer.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        if (key === unit?.key) place();
        else setUnit(readUnit(path, key));
      }}
      onPointerLeave={() => setUnit(null)}
    >
      {children}
      <div
        ref={cardRef}
        hidden={!unit}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-10 w-max max-w-64 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-strong)] px-2.5 py-2 text-xs leading-[1.35] text-ink shadow-float print:hidden"
      >
        {unit ? (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 [overflow-wrap:anywhere]">
              <dt className="text-ink-muted">{labels.lower}</dt>
              <dd className="font-semibold">{unit.name}</dd>
              {labels.middle && unit.middle ? (
                <>
                  <dt className="text-ink-muted">{labels.middle}</dt>
                  <dd>{unit.middle}</dd>
                </>
              ) : null}
              <dt className="text-ink-muted">{labels.higher}</dt>
              <dd>{unit.higher}</dd>
              <dt className="text-ink-muted">Year</dt>
              <dd className="tabular-nums">{year}</dd>
            </dl>
            <div className="mt-1.5 border-t border-[var(--border-soft)] pt-1.5">
              {/* One row per pillar; pillarMapStyles shows only the one the map is colored by. */}
              {PILLARS.map((pillar, index) => (
                <p key={pillar.id} data-tip-pillar={pillar.id} className="items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: pillar.cssVar }} />
                    {pillar.label} score
                  </span>
                  {unit.scores[index] ? (
                    <span className="font-heading text-sm font-semibold tabular-nums">{unit.scores[index]}</span>
                  ) : (
                    <span className="text-ink-muted">No score</span>
                  )}
                </p>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
