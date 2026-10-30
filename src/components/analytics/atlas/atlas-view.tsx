"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AtlasMap } from "@/components/analytics/atlas/atlas-map";
import { ClassedLegend } from "@/components/analytics/atlas/classed-legend";
import { RankingTable } from "@/components/analytics/ranking-table";
import { useRenderTheme } from "@/components/analytics/use-render-theme";
import { useWorkspace } from "@/components/analytics/workspace-bar";
import { Section } from "@/components/ui/section";
import { classifyFeatures } from "@/lib/analytics/derive";
import type { Country } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { AnalyticsPageData } from "@/types/analytics";

import { AtlasIndicatorRail } from "./atlas-indicator-rail";
import { AtlasProfile } from "./atlas-profile";
import { AtlasSearch, tidyUnitOptions } from "./atlas-search";
import { FOCUS_RING, PANEL_LABEL } from "./panel-styles";

/**
 * Atlas: the map is the page. At 1024px and up the indicator rail, the legend and the profile float
 * over a map that fills the viewport under the header and the workspace bar. Below that, the map is a
 * fixed-height block and the legend, the profile and the rail stack under it, in that order.
 * The ranking table follows the stage at every width.
 */

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const subscribeNever = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

// Panel widths come from CSS variables on the stage; the same numbers feed the map's fit padding.
const WIDTHS = { base: { left: 272, right: 320 }, wide: { left: 300, right: 360 } } as const;
const INSET = 16;
const TAB_W = 24;

const PANEL_SURFACE =
  "border-b border-[var(--border-soft)] bg-[var(--surface)] lg:pointer-events-auto lg:rounded-xl lg:border lg:border-[var(--border-strong)] lg:bg-[var(--surface-strong)] lg:shadow-float";

// Slide and fade on collapse. Reduced motion keeps the fade and drops the slide.
const PANEL_MOTION =
  "lg:transition-[translate,opacity,visibility] lg:duration-[180ms] lg:ease-out lg:data-[open=false]:invisible lg:data-[open=false]:opacity-0";

const TAB_CLASS =
  "absolute top-1/2 z-20 -mt-6 hidden h-12 w-6 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-strong)] text-ink-muted shadow-float transition-[translate,color] duration-[180ms] ease-out hover:text-ink motion-reduce:transition-none lg:flex";

// The map's own controls (zoom, attribution) sit in MapLibre corner containers. Slide the right-hand
// ones clear of the profile panel while it is open. maplibre-gl.css is unlayered and Tailwind utilities
// are layered, so the offsets need `!` to win.
const CONTROLS_BASE =
  "lg:[&_.maplibregl-ctrl-top-right]:transition-[right] lg:[&_.maplibregl-ctrl-top-right]:duration-[180ms] lg:[&_.maplibregl-ctrl-top-right]:ease-out lg:[&_.maplibregl-ctrl-top-right]:motion-reduce:transition-none lg:[&_.maplibregl-ctrl-bottom-right]:transition-[right] lg:[&_.maplibregl-ctrl-bottom-right]:duration-[180ms] lg:[&_.maplibregl-ctrl-bottom-right]:ease-out lg:[&_.maplibregl-ctrl-bottom-right]:motion-reduce:transition-none";
const CONTROLS_CLEAR_OF_PROFILE =
  "lg:[&_.maplibregl-ctrl-top-right]:right-[calc(var(--atlas-right-w)+1rem)]! lg:[&_.maplibregl-ctrl-bottom-right]:right-[calc(var(--atlas-right-w)+1rem)]!";

export function AtlasView({ data, country }: { data: AnalyticsPageData; country: Country }) {
  const isDark = useRenderTheme() === "dark";
  const { update, isPending } = useWorkspace();
  const isClient = useIsClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 1280px)");

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const metricId = data.selected.metricId;
  const [filter, setFilter] = useState<{ metricId: string; index: number | null }>({ metricId, index: null });
  const activeClassIndex = filter.metricId === metricId ? filter.index : null;
  const handleToggleClass = useCallback(
    (index: number | null) => {
      setFilter((current) => {
        const currentIndex = current.metricId === metricId ? current.index : null;
        return { metricId, index: index === null || index === currentIndex ? null : index };
      });
    },
    [metricId],
  );

  const classification = useMemo(
    () => classifyFeatures(data.map.features, data.map.metric.pillar, isDark ? "dark" : "light"),
    [data.map.features, data.map.metric.pillar, isDark],
  );

  const stage = useRef<HTMLElement>(null);
  const handleSelectUnit = useCallback((key: string) => update({ municipality: key }), [update]);
  const handleSelectMetric = useCallback((id: string) => update({ metric: id }), [update]);
  // The table sits under the stage, so bring the map and profile back into view to show the choice.
  const handleSelectFromRanking = useCallback(
    (id: string) => {
      update({ municipality: id });
      stage.current?.scrollIntoView({ block: "start" });
    },
    [update],
  );

  // Keep the country between the panels: pad by each open panel's width plus a gap.
  const widths = isWide ? WIDTHS.wide : WIDTHS.base;
  const fitPadding = useMemo(
    () =>
      isDesktop
        ? {
            top: INSET,
            bottom: 80,
            left: leftOpen ? INSET + widths.left + 14 : INSET + TAB_W + 16,
            right: rightOpen ? INSET + widths.right + 14 : INSET + TAB_W + 16,
          }
        : { top: 16, right: 16, bottom: 16, left: 16 },
    [isDesktop, leftOpen, rightOpen, widths.left, widths.right],
  );

  const profileScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    profileScroll.current?.scrollTo({ top: 0 });
  }, [data.selected.municipalityId]);

  const lowerSingular = country.adminLabels.lower.singular.toLowerCase();
  const unitOptions = useMemo(() => tidyUnitOptions(data.filters.municipalities), [data.filters.municipalities]);

  return (
    <>
      <section
        ref={stage}
        aria-label={`${country.name} map and ${lowerSingular} profile`}
        className="relative flex scroll-mt-[var(--app-header-h)] flex-col lg:block lg:h-[max(600px,calc(100svh-var(--app-header-h)-var(--workspace-bar-h)))] lg:scroll-mt-[calc(var(--app-header-h)+var(--workspace-bar-h))] lg:overflow-hidden lg:[--atlas-left-w:272px] lg:[--atlas-right-w:320px] xl:[--atlas-left-w:300px] xl:[--atlas-right-w:360px]"
      >
        {/* Map */}
        <div
          className={cn(
            "relative h-[60svh] min-h-80 shrink-0 overflow-hidden bg-background lg:absolute lg:inset-0 lg:h-auto lg:min-h-0",
            CONTROLS_BASE,
            rightOpen && CONTROLS_CLEAR_OF_PROFILE,
          )}
        >
          {isClient ? (
            <AtlasMap
              features={data.map.features}
              classification={classification}
              selectedCompositeKey={data.municipality.compositeKey}
              activeClassIndex={activeClassIndex}
              onSelect={handleSelectUnit}
              metricLabel={data.map.metric.label}
              metricName={data.map.metric.name}
              metricUnit={data.map.metric.unit}
              adminLabels={country.adminLabels}
              className="h-full w-full"
              fitPadding={fitPadding}
              controlsPosition="top-right"
            />
          ) : null}
        </div>

        {/* Collapse tabs, centered on each panel's outer edge. They come first in tab order so a panel can be closed before its contents. */}
        <button
          type="button"
          aria-expanded={leftOpen}
          aria-controls="atlas-indicators"
          aria-label={leftOpen ? "Hide indicator panel" : "Show indicator panel"}
          title={leftOpen ? "Hide indicator panel" : "Show indicator panel"}
          onClick={() => setLeftOpen((open) => !open)}
          className={cn(TAB_CLASS, FOCUS_RING, "left-0")}
          style={{ translate: leftOpen ? `calc(${INSET}px + var(--atlas-left-w) - ${TAB_W / 2}px) 0` : "8px 0" }}
        >
          {leftOpen ? <ChevronLeft aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
        </button>
        <button
          type="button"
          aria-expanded={rightOpen}
          aria-controls="atlas-profile"
          aria-label={rightOpen ? `Hide ${lowerSingular} panel` : `Show ${lowerSingular} panel`}
          title={rightOpen ? `Hide ${lowerSingular} panel` : `Show ${lowerSingular} panel`}
          onClick={() => setRightOpen((open) => !open)}
          className={cn(TAB_CLASS, FOCUS_RING, "right-0")}
          style={{ translate: rightOpen ? `calc(-1 * (${INSET}px + var(--atlas-right-w) - ${TAB_W / 2}px)) 0` : "-8px 0" }}
        >
          {rightOpen ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}
        </button>

        {/*
          Panels. Below lg they stack in document order: legend, profile, indicator list.
          From lg they sit in a grid over the map: indicators top left, legend bottom left, profile right.
        */}
        <div className="flex flex-col lg:pointer-events-none lg:absolute lg:inset-4 lg:z-10 lg:grid lg:grid-cols-[var(--atlas-left-w)_minmax(0,1fr)_var(--atlas-right-w)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-y-3">
          <div className={cn("px-4 py-3 lg:col-start-1 lg:row-start-2 lg:p-3", PANEL_SURFACE)}>
            <ClassedLegend
              classification={classification}
              metric={data.map.metric}
              activeClassIndex={activeClassIndex}
              onToggle={handleToggleClass}
              orientation="horizontal"
              density="compact"
              adminLabels={country.adminLabels}
              className="w-full"
            />
          </div>

          <aside
            id="atlas-profile"
            aria-label={`Selected ${lowerSingular}`}
            data-open={rightOpen}
            inert={isDesktop && !rightOpen}
            className={cn(
              PANEL_SURFACE,
              PANEL_MOTION,
              "flex flex-col lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:max-h-full lg:self-start lg:motion-safe:data-[open=false]:translate-x-[calc(100%+1rem)]",
            )}
          >
            <div className="relative z-10 shrink-0 border-b border-[var(--border-soft)] px-4 py-4">
              <AtlasSearch
                options={unitOptions}
                selectedId={data.selected.municipalityId}
                onSelect={(id) => update({ municipality: id })}
                label={`Find a ${lowerSingular}`}
              />
            </div>
            <div ref={profileScroll} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
              <AtlasProfile data={data} country={country} onSelectMetric={handleSelectMetric} isPending={isPending} />
            </div>
          </aside>

          <aside
            id="atlas-indicators"
            aria-label="Map indicator"
            data-open={leftOpen}
            inert={isDesktop && !leftOpen}
            className={cn(
              PANEL_SURFACE,
              PANEL_MOTION,
              "lg:col-start-1 lg:row-start-1 lg:max-h-full lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:motion-safe:data-[open=false]:translate-x-[calc(-100%-1rem)]",
            )}
          >
            {/* Padding keeps the rail's offset focus rings inside the scroll area. */}
            <div className="px-4 pb-4 pt-4">
              <h2 className={cn(PANEL_LABEL, "mb-2")}>Map indicator</h2>
              <AtlasIndicatorRail
                metrics={data.filters.metrics}
                activeMetricId={metricId}
                selectedMetricDefinition={data.metadata.selectedMetric}
                scoreDefinition={data.metadata.scoreDefinition}
                onSelectMetric={handleSelectMetric}
                isPending={isPending}
              />
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[95vw] px-4 pb-16 pt-10 sm:px-6 lg:px-10">
        <Section
          title="Ranking"
          description={`Ranked by ${data.map.metric.name} in ${data.selected.year}`}
          className="mx-auto max-w-6xl border-t-0 pt-0"
        >
          <RankingTable
            ranking={data.ranking}
            metric={data.map.metric}
            adminLabels={country.adminLabels}
            countrySlug={country.slug}
            year={data.selected.year}
            unitsWithoutBoundary={data.coverage.unitsWithoutBoundary}
            onSelect={handleSelectFromRanking}
          />
        </Section>
      </div>
    </>
  );
}
