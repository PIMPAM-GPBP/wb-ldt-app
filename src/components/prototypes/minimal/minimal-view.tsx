"use client";

import { useMemo, useState } from "react";


import { ClassedLegend } from "../shared/classed-legend";
import { classifyFeatures, formatScore, groupMetricsByPillar, splitUnit } from "../shared/derive";
import { PrototypeMap } from "../shared/prototype-map";
import type { PrototypeViewProps } from "../shared/types";
import { useSearchParamUpdater } from "../shared/use-search-param-updater";
import { useRenderTheme } from "../shared/use-render-theme";
import { MinimalDrivers } from "./minimal-drivers";
import { MinimalSidebar } from "./minimal-sidebar";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

/**
 * Direction C: the current Map & Drivers layout with the template treatment removed.
 * Same order as today (page head, filters sidebar, map, drivers), but flat: rules instead of
 * cards, one select with groups instead of a select plus Apply, one metadata line instead of tiles.
 */
export function MinimalView({ data, country }: PrototypeViewProps) {
  const { update, isPending } = useSearchParamUpdater();
  const isDark = useRenderTheme() === "dark";
  const theme = isDark ? "dark" : "light";

  // The URL is the source of truth. Local copies keep the select and legend filter responsive
  // while the server renders, and reset when a new metric lands.
  const [syncedMetricId, setSyncedMetricId] = useState(data.selected.metricId);
  const [metricId, setMetricId] = useState(data.selected.metricId);
  const [activeClassIndex, setActiveClassIndex] = useState<number | null>(null);
  if (syncedMetricId !== data.selected.metricId) {
    setSyncedMetricId(data.selected.metricId);
    setMetricId(data.selected.metricId);
    setActiveClassIndex(null);
  }

  const classification = useMemo(
    () => classifyFeatures(data.map.features, data.map.metric.pillar, theme),
    [data.map.features, data.map.metric.pillar, theme],
  );
  const metricGroups = useMemo(() => groupMetricsByPillar(data.filters.metrics), [data.filters.metrics]);

  const lowerSingular = country.adminLabels.lower.singular;
  const lowerPlural = lowerFirst(country.adminLabels.lower.plural);
  const unitName = data.municipality.municipality;
  const totalUnits = data.coverage.analyticsMunicipalityCount;
  const scoreCount = data.filters.metrics.filter((metric) => metric.kind === "score").length;
  const indicatorCount = data.filters.metrics.filter((metric) => metric.kind === "indicator").length;
  const withData = data.map.features.length - classification.nullCount;
  const { minimum, maximum, average } = data.map.summary;

  return (
    <main className="mx-auto flex w-full max-w-[95vw] flex-1 flex-col bg-[var(--proto-surface-sunken)] px-6 pb-20 pt-10 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div>
          <h1 className="font-heading text-[32px] font-semibold leading-tight tracking-tight text-[var(--proto-ink)]">
            {lowerSingular} scores, {country.name} {data.selected.year}
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--proto-muted)]">
            {scoreCount} pillar scores and {indicatorCount} indicators for {formatCount(totalUnits)} {lowerPlural},
            with the components behind the selected {lowerFirst(lowerSingular)}&rsquo;s gap to the national
            score.
          </p>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-[var(--proto-muted)]">
          Latest data year: {data.release.year}
        </p>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-10">
        <div
          className="-mx-1 self-start px-1 xl:sticky xl:max-h-[calc(100dvh_-_var(--proto-header-h)_-_48px)] xl:overflow-y-auto xl:overscroll-contain"
          style={{ top: "calc(var(--proto-header-h) + 24px)" }}
        >
          <MinimalSidebar data={data} country={country} onUpdate={update} isPending={isPending} />
        </div>

        <div
          aria-busy={isPending}
          className={`min-w-0 transition-opacity duration-150 ease-out motion-reduce:transition-none ${
            isPending ? "opacity-60" : "opacity-100"
          }`}
        >
          <section aria-labelledby="minimal-map-heading" className="border-t border-[var(--proto-rule)] pt-6">
            <h2
              id="minimal-map-heading"
              className="font-heading text-2xl font-semibold leading-tight text-[var(--proto-ink)]"
            >
              Map and drivers
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--proto-muted)]">
              Shade the map by one pillar score or indicator. Select a {lowerFirst(lowerSingular)} on the map to
              see its drivers below.
            </p>

            <div className="mt-5 flex max-w-sm flex-col gap-1.5">
              <label htmlFor="minimal-map-metric" className="text-sm font-medium text-[var(--proto-ink)]">
                Map metric
              </label>
              <select
                id="minimal-map-metric"
                value={metricId}
                onChange={(event) => {
                  setMetricId(event.target.value);
                  setActiveClassIndex(null);
                  update({ metric: event.target.value });
                }}
                className={`h-11 w-full cursor-pointer rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface)] px-3 text-sm text-[var(--proto-ink)] md:h-10 ${FOCUS_RING}`}
              >
                {metricGroups.map((group) => {
                  const options = [...(group.score ? [group.score] : []), ...group.indicators];
                  if (options.length === 0) return null;
                  return (
                    <optgroup key={group.pillar ?? "other"} label={group.label}>
                      {options.map((metric) => (
                        <option key={metric.id} value={metric.id}>
                          {splitUnit(metric.label).name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <h3 className="font-heading text-[22px] font-semibold leading-tight text-[var(--proto-ink)]">
                {splitUnit(data.map.metric.label).name}
              </h3>
              <p className="text-sm tabular-nums text-[var(--proto-muted)]">
                {formatCount(data.coverage.mapMunicipalityCount)} of {formatCount(totalUnits)} {lowerPlural} mapped
              </p>
            </div>

            <PrototypeMap
              features={data.map.features}
              classification={classification}
              selectedCompositeKey={data.municipality.compositeKey}
              activeClassIndex={activeClassIndex}
              onSelect={(compositeKey) => update({ municipality: compositeKey })}
              metricLabel={data.map.metric.label}
              adminLabels={country.adminLabels}
              className="mt-3 h-[400px] w-full overflow-hidden rounded-[var(--proto-radius-panel)] border border-[var(--proto-rule)] md:h-[520px]"
            />

            <ClassedLegend
              classification={classification}
              metric={data.map.metric}
              activeClassIndex={activeClassIndex}
              onToggle={setActiveClassIndex}
              orientation="horizontal"
              className="mt-3"
            />

            <p className="mt-3 text-sm tabular-nums text-[var(--proto-muted)]">
              Lowest <span className="text-[var(--proto-ink)]">{formatScore(minimum, 1)}</span>
              {" · "}Highest <span className="text-[var(--proto-ink)]">{formatScore(maximum, 1)}</span>
              {" · "}Average <span className="text-[var(--proto-ink)]">{formatScore(average, 1)}</span>
              {" · "}
              <span className="text-[var(--proto-ink)]">{formatCount(withData)}</span> with data
            </p>
          </section>

          <section
            aria-labelledby="minimal-drivers-heading"
            className="mt-10 border-t border-[var(--proto-rule)] pt-6"
          >
            <h2
              id="minimal-drivers-heading"
              className="mb-5 font-heading text-2xl font-semibold leading-tight text-[var(--proto-ink)]"
            >
              What pulls {unitName} above or below the national score
            </h2>
            <MinimalDrivers
              groups={data.waterfalls}
              municipalityName={unitName}
              adminLabels={country.adminLabels}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
