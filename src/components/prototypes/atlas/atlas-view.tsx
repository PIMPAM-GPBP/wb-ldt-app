"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { classifyFeatures } from "../shared/derive";
import { ClassedLegend } from "../shared/classed-legend";
import { PrototypeMap } from "../shared/prototype-map";
import type { PrototypeViewProps } from "../shared/types";
import { useSearchParamUpdater } from "../shared/use-search-param-updater";
import { useRenderTheme } from "../shared/use-render-theme";
import { AtlasIndicatorRail } from "./atlas-indicator-rail";
import { AtlasProfile } from "./atlas-profile";
import { AtlasSearch } from "./atlas-search";

/**
 * Atlas: the map is the page. At 1024px and up the indicator rail, the profile and the legend
 * float over a full-bleed map. Below that, the map is a 60svh block and everything stacks under it.
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

const PENDING_KEYFRAMES = "@keyframes atlas-pending{from{transform:translateX(-100%)}to{transform:translateX(250%)}}";

const PANEL_SURFACE =
  "border-b border-[var(--proto-rule)] bg-[var(--proto-surface)] lg:pointer-events-auto lg:rounded-[var(--proto-radius-panel)] lg:border lg:border-[var(--proto-rule-strong)] lg:bg-[var(--proto-surface-raised)] lg:shadow-[var(--proto-elevation)]";

// Slide and fade on collapse. Reduced motion keeps the fade and drops the slide.
const PANEL_MOTION =
  "lg:transition-[translate,opacity,visibility] lg:duration-[180ms] lg:ease-out lg:data-[open=false]:invisible lg:data-[open=false]:opacity-0";

const TAB_CLASS =
  "absolute top-1/2 z-20 -mt-6 hidden h-12 w-6 items-center justify-center rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface-raised)] text-[var(--proto-muted)] shadow-[var(--proto-elevation)] transition-[translate,color] duration-[180ms] ease-out hover:text-[var(--proto-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)] motion-reduce:transition-none lg:flex";

// The map's own controls (zoom, attribution) sit in MapLibre corner containers. Slide the right-hand
// ones clear of the profile panel while it is open.
const CONTROLS_BASE =
  "lg:[&_.maplibregl-ctrl-top-right]:transition-[right] lg:[&_.maplibregl-ctrl-top-right]:duration-[180ms] lg:[&_.maplibregl-ctrl-top-right]:ease-out lg:[&_.maplibregl-ctrl-top-right]:motion-reduce:transition-none lg:[&_.maplibregl-ctrl-bottom-right]:transition-[right] lg:[&_.maplibregl-ctrl-bottom-right]:duration-[180ms] lg:[&_.maplibregl-ctrl-bottom-right]:ease-out lg:[&_.maplibregl-ctrl-bottom-right]:motion-reduce:transition-none";
const CONTROLS_CLEAR_OF_PROFILE =
  "lg:[&_.maplibregl-ctrl-top-right]:right-[calc(var(--atlas-right-w)_+_1rem)] lg:[&_.maplibregl-ctrl-bottom-right]:right-[calc(var(--atlas-right-w)_+_1rem)]";

export function AtlasView({ data, country }: PrototypeViewProps) {
  const isDark = useRenderTheme() === "dark";
  const { update, isPending } = useSearchParamUpdater();
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

  const handleSelectUnit = useCallback((key: string) => update({ municipality: key }), [update]);
  const handleSelectMetric = useCallback((id: string) => update({ metric: id }), [update]);

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
  const lowerPlural = country.adminLabels.lower.plural.toLowerCase();

  return (
    <section
      aria-label={`${country.name} map and ${lowerSingular} profile`}
      className="relative flex flex-col lg:block lg:h-[max(600px,calc(100svh_-_var(--proto-header-h)))] lg:overflow-hidden lg:[--atlas-left-w:272px] lg:[--atlas-right-w:320px] xl:[--atlas-left-w:300px] xl:[--atlas-right-w:360px]"
    >
      {/* Map */}
      <div
        className={cn(
          "relative h-[60svh] min-h-80 shrink-0 overflow-hidden bg-[var(--proto-surface-sunken)] lg:absolute lg:inset-0 lg:h-auto lg:min-h-0",
          CONTROLS_BASE,
          rightOpen && CONTROLS_CLEAR_OF_PROFILE,
        )}
      >
        {isClient ? (
          <PrototypeMap
            features={data.map.features}
            classification={classification}
            selectedCompositeKey={data.municipality.compositeKey}
            activeClassIndex={activeClassIndex}
            onSelect={handleSelectUnit}
            metricLabel={data.map.metric.label}
            adminLabels={country.adminLabels}
            className="h-full w-full"
            fitPadding={fitPadding}
            controlsPosition="top-right"
          />
        ) : null}
        <style>{PENDING_KEYFRAMES}</style>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none",
            isPending ? "opacity-100" : "opacity-0",
          )}
        >
          <div
            className={cn(
              "h-full w-2/5 bg-[var(--proto-accent)] motion-reduce:w-full motion-reduce:opacity-50",
              isPending && "[animation:atlas-pending_1.2s_linear_infinite] motion-reduce:[animation:none]",
            )}
          />
        </div>
      </div>

      {/* Left column: indicator panel with the legend beneath it */}
      <div className="flex flex-col lg:pointer-events-none lg:absolute lg:inset-y-4 lg:left-4 lg:z-10 lg:w-[var(--atlas-left-w)] lg:gap-3">
        <aside
          id="atlas-indicators"
          aria-label="Map indicator"
          data-open={leftOpen}
          inert={isDesktop && !leftOpen}
          className={cn(
            PANEL_SURFACE,
            PANEL_MOTION,
            "lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:motion-safe:data-[open=false]:translate-x-[calc(-100%_-_1rem)]",
          )}
        >
          <div className="px-4 pb-3 pt-4">
            <h1 className="font-heading text-lg font-semibold leading-tight text-[var(--proto-ink)]">
              {country.name}{" "}
              <span className="font-normal tabular-nums text-[var(--proto-muted)]">{data.selected.year}</span>
            </h1>
            <p className="mt-0.5 text-xs tabular-nums text-[var(--proto-muted)]">
              {data.coverage.analyticsMunicipalityCount.toLocaleString("en-US")} {lowerPlural}
            </p>
          </div>
          {/* Padding keeps the rail's offset focus rings inside the scroll area. */}
          <div className="px-4 pb-4">
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

        <div
          className={cn(
            "order-first px-4 py-3 lg:order-none lg:mt-auto lg:shrink-0 lg:p-3",
            PANEL_SURFACE,
          )}
        >
          <ClassedLegend
            classification={classification}
            metric={data.map.metric}
            activeClassIndex={activeClassIndex}
            onToggle={handleToggleClass}
            orientation="horizontal"
            density="compact"
            className="w-full"
          />
        </div>
      </div>

      {/* Right panel: search, then the selected unit's profile */}
      <aside
        id="atlas-profile"
        aria-label={`Selected ${lowerSingular}`}
        data-open={rightOpen}
        inert={isDesktop && !rightOpen}
        className={cn(
          PANEL_SURFACE,
          PANEL_MOTION,
          "flex flex-col lg:absolute lg:right-4 lg:top-4 lg:z-10 lg:max-h-[calc(100%_-_2rem)] lg:w-[var(--atlas-right-w)] lg:motion-safe:data-[open=false]:translate-x-[calc(100%_+_1rem)]",
        )}
      >
        <div className="relative z-10 shrink-0 border-b border-[var(--proto-rule)] px-4 py-4">
          <AtlasSearch
            options={data.filters.municipalities}
            selectedId={data.selected.municipalityId}
            onSelect={(id) => update({ municipality: id })}
            label={`Find a ${lowerSingular}`}
          />
        </div>
        <div ref={profileScroll} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
          <AtlasProfile data={data} country={country} onSelectMetric={handleSelectMetric} isPending={isPending} />
        </div>
      </aside>

      {/* Collapse tabs, centered on each panel's outer edge */}
      <button
        type="button"
        aria-expanded={leftOpen}
        aria-controls="atlas-indicators"
        aria-label={leftOpen ? "Hide indicator panel" : "Show indicator panel"}
        title={leftOpen ? "Hide indicator panel" : "Show indicator panel"}
        onClick={() => setLeftOpen((open) => !open)}
        className={cn(TAB_CLASS, "left-0")}
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
        className={cn(TAB_CLASS, "right-0")}
        style={{ translate: rightOpen ? `calc(-1 * (${INSET}px + var(--atlas-right-w) - ${TAB_W / 2}px)) 0` : "-8px 0" }}
      >
        {rightOpen ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}
      </button>
    </section>
  );
}
