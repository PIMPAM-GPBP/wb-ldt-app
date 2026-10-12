import Link from "next/link";
import { notFound } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import { AiAnalyticsTab } from "@/components/analytics/ai-analytics-tab";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { ChoroplethMapCard } from "@/components/analytics/choropleth-map";
import { MunicipalitySummaryCard } from "@/components/analytics/municipality-summary-card";
import { Scatter2DCard } from "@/components/analytics/scatter-2d";
import { Scatter3DLoader } from "@/components/analytics/scatter-3d-loader";
import { ScoreWaterfallSection } from "@/components/analytics/score-waterfall-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCountryBySlug, type Country } from "@/lib/countries";
import { getAnalyticsPageData } from "@/lib/data/queries";

function getSearchValue(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function buildTabHref(
  countrySlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  tab: string,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "tab") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value[0]) {
        params.set(key, value[0]);
      }
      continue;
    }

    if (value) {
      params.set(key, value);
    }
  }

  params.set("tab", tab);
  return `/${countrySlug}/analytics?${params.toString()}`;
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function SelectControl({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 w-full flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnalyticsPendingPage({ country }: { country: Country }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-18 sm:px-8 lg:px-10">
      <section className="rounded-[2rem] border border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-muted))] p-8 shadow-[0_18px_50px_var(--surface-shadow)] sm:p-10">
        <span className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {country.name} analytics
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
          Analytics data under construction
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
          The {country.name} workspace is already routed, but its analytics dataset, generated fallback files, and map
          assets have not been loaded yet.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button nativeButton={false} render={<Link href={`/${country.slug}`} />}>
            Back to {country.name}
          </Button>
          <Button nativeButton={false} render={<Link href="/" />} variant="outline">
            Back to country portal
          </Button>
        </div>
      </section>
    </main>
  );
}

function AiPlanningUnavailable({ country }: { country: Country }) {
  return (
    <Card className="border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          AI planning brief
        </p>
        <CardTitle className="text-2xl">
          Planning documents are not loaded for {country.name} yet
        </CardTitle>
        <CardDescription className="max-w-4xl leading-7">
          {country.planningDocuments.message}. The score comparison, map, and driver
          analysis views are available now; country-specific planning evidence will be
          enabled in a later release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          nativeButton={false}
          render={<Link href={`/${country.slug}/analytics?tab=multi`} />}
          variant="outline"
        >
          Back to Compare Scores
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const country = getCountryBySlug(resolvedParams.country);

  if (!country) {
    notFound();
  }

  if (country.analyticsStatus !== "live") {
    return <AnalyticsPendingPage country={country} />;
  }

  const resolvedSearchParams = await searchParams;
  const selectedTab = getSearchValue(resolvedSearchParams.tab, "multi");
  const dataSearchParams =
    selectedTab === "ai" && !country.planningDocuments.aiEnabled
      ? { ...resolvedSearchParams, tab: "multi" }
      : resolvedSearchParams;
  const data = await getAnalyticsPageData(dataSearchParams, country.code);
  const lowerSingular = country.adminLabels.lower.singular;
  const lowerPlural = country.adminLabels.lower.plural;
  const higherSingular = country.adminLabels.higher.singular;
  const lowerSingularLabel = lowerFirst(lowerSingular);
  const lowerPluralLabel = lowerFirst(lowerPlural);
  const higherSingularLabel = lowerFirst(higherSingular);

  return (
    <main className="mx-auto flex w-full max-w-[95vw] flex-1 flex-col px-6 pb-16 pt-10 sm:px-8 lg:px-10">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          Analytics
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              {lowerSingular} development analysis
            </h1>
            <p className="mt-3 max-w-4xl text-base leading-8 text-[var(--muted-foreground)]">
              Move through comparison, geographic driver review, and AI-assisted planning outputs without losing the
              selected year, {higherSingularLabel}, {lowerSingularLabel}, or metric context.
            </p>
          </div>
          <Badge variant="outline" className="h-7 rounded-lg px-3 text-sm">
            {country.name} | Latest Data Year: {data.release.year}
          </Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="self-start xl:sticky xl:top-24">
          <div className="flex flex-col gap-4">
            <Card size="sm" className="border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
              <CardHeader>
                <CardTitle>Analytics workflow</CardTitle>
                <CardDescription>Select a task area. Filters stay in the URL.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} orientation="vertical">
                  <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0">
                    <TabsTrigger
                      value="multi"
                      nativeButton={false}
                      render={<Link href={buildTabHref(country.slug, resolvedSearchParams, "multi")} />}
                      className="h-auto justify-start rounded-lg border border-border bg-background px-3 py-2 text-left data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
                    >
                      Compare Scores
                    </TabsTrigger>
                    <TabsTrigger
                      value="single"
                      nativeButton={false}
                      render={<Link href={buildTabHref(country.slug, resolvedSearchParams, "single")} />}
                      className="h-auto justify-start rounded-lg border border-border bg-background px-3 py-2 text-left data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
                    >
                      Map & Drivers
                    </TabsTrigger>
                    <TabsTrigger
                      value="ai"
                      nativeButton={false}
                      render={<Link href={buildTabHref(country.slug, resolvedSearchParams, "ai")} />}
                      className="h-auto justify-start rounded-lg border border-border bg-background px-3 py-2 text-left data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
                    >
                      AI Planning Brief
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            <AnalyticsFilters
              years={data.filters.years}
              provinces={data.filters.provinces}
              municipalities={data.filters.municipalities}
              selected={data.selected}
              selectedTab={selectedTab}
              adminLabels={country.adminLabels}
              mode="sidebar"
            />

            <MunicipalitySummaryCard
              municipality={data.municipality}
              nationalScoreAverages={data.nationalAverages.scores}
              adminLabels={country.adminLabels}
              compact
            />
          </div>
        </aside>

        {selectedTab === "ai" && !country.planningDocuments.aiEnabled ? (
          <AiPlanningUnavailable country={country} />
        ) : selectedTab === "ai" ? (
          <AiAnalyticsTab
            key={`${data.release.key}:${data.municipality.id}:${data.ai.selectedScoreId}`}
            release={data.release}
            selected={data.selected}
            municipality={data.municipality}
            ai={data.ai}
          />
        ) : selectedTab === "single" ? (
        <div className="flex flex-col gap-6">
          <Card className="border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
            <CardHeader>
              <CardTitle className="text-2xl">Map & Drivers</CardTitle>
              <CardDescription className="max-w-4xl leading-7">
                Inspect one pillar score or indicator across {country.name}, then use driver charts to identify what pulls the
                selected {lowerSingularLabel} above or below the national baseline.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
            <CardContent>
            <form
              key={`${data.selected.year}:${data.selected.province}:${data.selected.municipalityId}:${data.selected.metricId}`}
              className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]"
            >
              <input type="hidden" name="tab" value="single" />
              <input type="hidden" name="year" value={String(data.selected.year)} />
              <input type="hidden" name="province" value={data.selected.province} />
              <input type="hidden" name="municipality" value={data.selected.municipalityId} />
              <input type="hidden" name="x" value={data.selected.xMetricId} />
              <input type="hidden" name="y" value={data.selected.yMetricId} />
              <input type="hidden" name="ai_score" value={data.selected.aiScoreId} />
              <SelectControl
                label="Map metric"
                name="metric"
                defaultValue={data.selected.metricId}
                options={data.filters.metrics.map((metric) => ({
                  value: metric.id,
                  label: metric.label,
                }))}
              />
              <Button
                type="submit"
                className="self-end"
              >
                <SlidersHorizontal data-icon="inline-start" />
                Apply
              </Button>
            </form>
            </CardContent>
          </Card>

          <div className="mt-8 space-y-6">
            <section>
              <ChoroplethMapCard
                features={data.map.features}
                metric={data.map.metric}
                selectedCompositeKey={data.municipality.compositeKey}
                coverageLabel={`${data.coverage.mapMunicipalityCount} mapped of ${data.coverage.analyticsMunicipalityCount} analytics ${lowerPluralLabel}`}
                minimum={data.map.summary.minimum}
                maximum={data.map.summary.maximum}
                adminLabels={country.adminLabels}
              />
            </section>
            <ScoreWaterfallSection
              groups={data.waterfalls}
              municipalityName={data.municipality.municipality}
              provinceName={data.municipality.province}
              adminLabels={country.adminLabels}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
            <CardHeader>
              <CardTitle className="text-2xl">Compare Scores</CardTitle>
              <CardDescription className="max-w-4xl leading-7">
                Compare {lowerPluralLabel} across the core pillars in 2D and 3D. The selected {lowerSingularLabel} remains
                highlighted against peers in the same {higherSingularLabel}.
              </CardDescription>
            </CardHeader>
          </Card>

          <section className="space-y-6">
            <Scatter2DCard
              xLabel={data.scatter2d.xMetric.label}
              yLabel={data.scatter2d.yMetric.label}
              selectedProvince={data.municipality.province}
              adminLabels={country.adminLabels}
              controls={
                <form
                  key={`${data.selected.year}:${data.selected.province}:${data.selected.municipalityId}:${data.selected.xMetricId}:${data.selected.yMetricId}`}
                  className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="tab" value="multi" />
                  <input type="hidden" name="year" value={String(data.selected.year)} />
                  <input type="hidden" name="province" value={data.selected.province} />
                  <input type="hidden" name="municipality" value={data.selected.municipalityId} />
                  <input type="hidden" name="metric" value={data.selected.metricId} />
                  <input type="hidden" name="ai_score" value={data.selected.aiScoreId} />
                  <SelectControl
                    label="Scatter X"
                    name="x"
                    defaultValue={data.selected.xMetricId}
                    options={data.filters.scoreMetrics.map((metric) => ({
                      value: metric.id,
                      label: metric.label,
                    }))}
                  />
                  <SelectControl
                    label="Scatter Y"
                    name="y"
                    defaultValue={data.selected.yMetricId}
                    options={data.filters.scoreMetrics.map((metric) => ({
                      value: metric.id,
                      label: metric.label,
                    }))}
                  />
                  <Button
                    type="submit"
                    className="self-end"
                  >
                    <SlidersHorizontal data-icon="inline-start" />
                    Apply
                  </Button>
                </form>
              }
              points={data.scatter2d.points}
            />
            <Scatter3DLoader
              selectedProvince={data.municipality.province}
              adminLabels={country.adminLabels}
              points={data.scatter3d.points}
            />
          </section>
        </div>
      )}
      </div>
    </main>
  );
}
