"use client";

import { useMemo, useState } from "react";

import type { MetricDefinition } from "@/types/analytics";

import { ClassedLegend } from "../shared/classed-legend";
import {
  PILLARS,
  classifyFeatures,
  getPillarStandings,
  groupMetricsByPillar,
  rankFeatures,
  splitUnit,
} from "../shared/derive";
import { PrototypeMap } from "../shared/prototype-map";
import type { PrototypeViewProps } from "../shared/types";
import { useSearchParamUpdater } from "../shared/use-search-param-updater";
import { useRenderTheme } from "../shared/use-render-theme";
import { ReportDrivers } from "./report-drivers";
import { formatCount } from "./report-format";
import { ReportPillarStrip, reportTabId } from "./report-pillar-strip";
import { ReportRankingTable } from "./report-ranking-table";
import { ReportStanding } from "./report-standing";

const PANEL_ID = "report-panel";
const FADE = "transition-opacity duration-150 ease-out motion-reduce:transition-none";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";
const SECTION_HEAD = "font-heading text-xl font-semibold tracking-tight text-[var(--proto-ink)]";

/** What the last interaction asked for, shown ahead of the server round trip. */
type Pending = { kind: "metric"; metric: MetricDefinition } | { kind: "unit"; selectValue: string | null };

export function ReportView({ data, country }: PrototypeViewProps) {
  const { update, isPending } = useSearchParamUpdater();
  const isDark = useRenderTheme() === "dark";
  const labels = country.adminLabels;
  const lowerSingular = labels.lower.singular;
  const lowerPlural = labels.lower.plural.toLowerCase();

  const [pending, setPending] = useState<Pending | null>(null);
  const [legendFilter, setLegendFilter] = useState<{ metricId: string; index: number | null }>({
    metricId: data.selected.metricId,
    index: null,
  });

  const standings = useMemo(() => getPillarStandings(data), [data]);
  const groups = useMemo(() => groupMetricsByPillar(data.filters.metrics), [data.filters.metrics]);
  const classification = useMemo(
    () => classifyFeatures(data.map.features, data.map.metric.pillar, isDark ? "dark" : "light"),
    [data.map.features, data.map.metric.pillar, isDark],
  );
  const rows = useMemo(() => rankFeatures(data.map.features), [data.map.features]);

  // The strip and the indicator row switch at once; everything below follows when the data lands.
  const pendingKind = isPending ? (pending?.kind ?? null) : null;
  const shownMetric = isPending && pending?.kind === "metric" ? pending.metric : data.map.metric;
  const unitSelectValue =
    isPending && pending?.kind === "unit" && pending.selectValue ? pending.selectValue : data.selected.municipalityId;

  const shownIndex = Math.max(0, PILLARS.findIndex((pillar) => pillar.id === shownMetric.pillar));
  const settledIndex = Math.max(0, PILLARS.findIndex((pillar) => pillar.id === data.map.metric.pillar));
  const shownPillar = PILLARS[shownIndex];
  const settledPillar = PILLARS[settledIndex];
  const settledStanding = standings[settledIndex];
  const shownGroup = groups.find((group) => group.pillar === shownPillar.id) ?? null;
  const scoreMetric = shownGroup?.score ?? null;

  const activeClassIndex = legendFilter.metricId === data.selected.metricId ? legendFilter.index : null;

  function selectMetric(metricId: string) {
    const metric = data.filters.metrics.find((entry) => entry.id === metricId);
    if (!metric || metricId === shownMetric.id) return;
    setPending({ kind: "metric", metric });
    update({ metric: metricId });
  }

  function selectUnit(key: string, fromSelect: boolean) {
    setPending({ kind: "unit", selectValue: fromSelect ? key : null });
    update({ municipality: key });
  }

  function toggleClass(index: number | null) {
    const metricId = data.selected.metricId;
    setLegendFilter((current) => {
      const currentIndex = current.metricId === metricId ? current.index : null;
      return { metricId, index: index === null || index === currentIndex ? null : index };
    });
  }

  const waterfall = data.waterfalls.find((group) => group.scoreId === settledStanding.scoreId) ?? null;
  const metricName = splitUnit(data.map.metric.label);
  const description = describeMetric(data, waterfall?.rows.map((row) => row.label) ?? []);

  const locationParts = [
    labels.middle ? `${data.municipality.district} ${labels.middle.singular}` : null,
    `${data.municipality.province} ${labels.higher.singular}`,
  ].filter(Boolean);
  const population = data.municipality.context.population;

  return (
    <main className="flex-1 bg-[var(--proto-surface)] pb-20 text-[var(--proto-ink)]">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        <header className="flex flex-col gap-5 pb-7 pt-8 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className={`min-w-0 ${FADE} ${pendingKind === "unit" ? "opacity-60" : ""}`}>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {data.municipality.municipality}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-2 text-[15px] text-[var(--proto-muted)]">
              <span>{locationParts.join(", ")}</span>
              {population !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Population {formatCount(population)}</span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{data.selected.year} data</span>
            </p>
          </div>

          <div className="w-full shrink-0 sm:w-72">
            <label htmlFor="report-unit" className="mb-1 block text-xs text-[var(--proto-muted)]">
              {lowerSingular}
            </label>
            <div className="relative">
              <select
                id="report-unit"
                value={unitSelectValue}
                onChange={(event) => selectUnit(event.target.value, true)}
                className={`h-11 w-full appearance-none rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface)] pl-3 pr-9 text-base text-[var(--proto-ink)] sm:h-10 sm:text-sm ${FOCUS}`}
              >
                {data.filters.municipalities.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-[var(--proto-muted)]"
              >
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </header>

        <div className={`${FADE} ${pendingKind === "unit" ? "opacity-60" : ""}`}>
          <ReportPillarStrip
            standings={standings}
            activeScoreId={standings[shownIndex].scoreId}
            onSelect={selectMetric}
            panelId={PANEL_ID}
            unitName={data.municipality.municipality}
          />
        </div>

        <div
          role="tabpanel"
          id={PANEL_ID}
          aria-labelledby={reportTabId(standings[shownIndex].scoreId)}
          aria-busy={isPending}
          className={`${FADE} ${isPending ? "opacity-60" : ""}`}
        >
          <section aria-label="Map layer" className="py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span id="report-map-shows" className="mr-1 text-sm text-[var(--proto-muted)]">
                Map shows
              </span>
              <div role="group" aria-labelledby="report-map-shows" className="flex flex-wrap gap-2">
                {scoreMetric ? (
                  <MetricButton
                    label={`${shownPillar.label} score`}
                    title={scoreMetric.label}
                    pressed={shownMetric.id === scoreMetric.id}
                    onClick={() => selectMetric(scoreMetric.id)}
                  />
                ) : null}
                {shownGroup?.indicators.map((indicator) => (
                  <MetricButton
                    key={indicator.id}
                    label={splitUnit(indicator.label).name}
                    title={indicator.label}
                    pressed={shownMetric.id === indicator.id}
                    onClick={() => selectMetric(indicator.id)}
                  />
                ))}
              </div>
            </div>
            {description ? (
              <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-[var(--proto-muted)]">{description}</p>
            ) : null}
          </section>

          <section aria-label={`Map of ${metricName.name}`} className="border-t border-[var(--proto-rule)]">
            <PrototypeMap
              features={data.map.features}
              classification={classification}
              selectedCompositeKey={data.municipality.compositeKey}
              activeClassIndex={activeClassIndex}
              onSelect={(key) => selectUnit(key, false)}
              metricLabel={data.map.metric.label}
              adminLabels={labels}
              className="h-[max(520px,70vh)] w-full"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-[var(--proto-rule)] py-3">
              <ClassedLegend
                classification={classification}
                metric={data.map.metric}
                activeClassIndex={activeClassIndex}
                onToggle={toggleClass}
                orientation="horizontal"
              />
              <p className="text-sm tabular-nums text-[var(--proto-muted)]">
                {formatCount(data.coverage.mapMunicipalityCount)} of {formatCount(data.coverage.analyticsMunicipalityCount)}{" "}
                {lowerPlural} on the map
              </p>
            </div>
          </section>

          <div className="grid border-t border-[var(--proto-rule)] py-8 lg:grid-cols-2">
            <section aria-labelledby="report-drivers-head" className="lg:pr-10">
              <h2 id="report-drivers-head" className={SECTION_HEAD}>
                What drives the {settledPillar.label.toLowerCase()} score
              </h2>
              <div className="mt-4">
                <ReportDrivers group={waterfall} adminLabels={labels} municipalityName={data.municipality.municipality} />
              </div>
            </section>
            <section
              aria-labelledby="report-standing-head"
              className="mt-10 border-t border-[var(--proto-rule)] pt-8 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0"
            >
              <h2 id="report-standing-head" className={SECTION_HEAD}>
                Where it stands
              </h2>
              <div className="mt-4">
                <ReportStanding
                  standing={settledStanding}
                  pillarCssVar={settledPillar.cssVar}
                  municipalityName={data.municipality.municipality}
                  province={data.municipality.province}
                  adminLabels={labels}
                />
              </div>
            </section>
          </div>

          <section
            aria-labelledby="report-ranking-head"
            className="border-t border-[var(--proto-rule)] bg-[var(--proto-surface)] py-8"
          >
            <h2 id="report-ranking-head" className={SECTION_HEAD}>
              {formatCount(data.map.features.length)} mapped {lowerPlural} ranked by {metricName.name}
            </h2>
            <div className="mt-4">
              <ReportRankingTable
                rows={rows}
                selectedCompositeKey={data.municipality.compositeKey}
                metricLabel={data.map.metric.label}
                adminLabels={labels}
                onSelect={(key) => selectUnit(key, false)}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricButton({
  label,
  title,
  pressed,
  onClick,
}: {
  label: string;
  title: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] px-3 text-sm transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none md:min-h-9 ${FOCUS} ${
        pressed
          ? "border-[var(--proto-accent)] bg-[var(--proto-accent)] font-medium text-[var(--proto-surface)]"
          : "text-[var(--proto-ink)] hover:bg-[var(--proto-surface-sunken)]"
      }`}
    >
      {label}
    </button>
  );
}

/** One muted line under the layer buttons: the indicator's definition, or what the score is made of. */
function describeMetric(data: PrototypeViewProps["data"], componentLabels: string[]) {
  const metric = data.map.metric;
  if (metric.kind === "score") {
    if (componentLabels.length === 0) return null;
    return `Combines ${componentLabels.length} components: ${componentLabels.join(", ")}.`;
  }

  const { unit } = splitUnit(metric.label);
  const parts = [
    data.metadata.selectedMetric?.description?.trim() || null,
    unit ? `Unit: ${unit}.` : null,
    metric.higherIsBetter === true ? "Higher is better." : metric.higherIsBetter === false ? "Lower is better." : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
