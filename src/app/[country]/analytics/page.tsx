import Link from "next/link";
import { notFound } from "next/navigation";

import { AtlasView } from "@/components/analytics/atlas/atlas-view";
import { BriefView } from "@/components/analytics/brief/brief-view";
import { CompareView } from "@/components/analytics/compare-view";
import { WorkspaceBar, WorkspaceProvider, WorkspaceUnitSearch } from "@/components/analytics/workspace-bar";
import { Button } from "@/components/ui/button";
import { getBriefData } from "@/lib/brief/brief-data";
import { getCountryBySlug, type Country } from "@/lib/countries";
import { getAnalyticsPageData } from "@/lib/data/queries";

type SearchParams = Record<string, string | string[] | undefined>;

// Map is the default view. The ids are the values of the `tab` URL parameter.
const VIEWS = [
  { id: "single", label: "Map" },
  { id: "multi", label: "Compare" },
  { id: "brief", label: "Planning brief" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

// Page content below the workspace bar lines up with the app header's edges.
const CONTENT = "mx-auto w-full max-w-[95vw] px-4 sm:px-6 lg:px-10";

function getSearchValue(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

/** The same page with another view, keeping every other parameter. */
function buildViewHref(countrySlug: string, searchParams: SearchParams, view: ViewId) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "tab") {
      continue;
    }

    const first = Array.isArray(value) ? value[0] : value;
    if (first) {
      params.set(key, first);
    }
  }

  params.set("tab", view);
  return `/${countrySlug}/analytics?${params.toString()}`;
}

function AnalyticsPendingPage({ country }: { country: Country }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-16 sm:px-6 lg:px-10">
      <h1 className="font-heading text-3xl font-semibold leading-tight text-ink">
        {country.name} scores are not loaded yet
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-ink-muted">
        The scores and boundary map for {country.name} have not been added. They will appear here once they are.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href={`/${country.slug}`} />}>
          Back to {country.name}
        </Button>
        <Button nativeButton={false} render={<Link href="/" />} variant="outline">
          All countries
        </Button>
      </div>
    </main>
  );
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<SearchParams>;
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
  // "ai" was the brief's id before the brief became code-only; old links still land on it.
  const requestedView = getSearchValue(resolvedSearchParams.tab, "single").replace(/^ai$/, "brief");
  const activeView: ViewId = VIEWS.find((view) => view.id === requestedView)?.id ?? "single";
  const data = await getAnalyticsPageData({ ...resolvedSearchParams, tab: activeView }, country.code);
  const brief = activeView === "brief" ? await getBriefData(country, data.municipality.compositeKey) : null;

  return (
    <WorkspaceProvider>
      <WorkspaceBar
        countryName={country.name}
        adminLabels={country.adminLabels}
        year={data.selected.year}
        unitCount={data.filters.municipalities.length}
        years={data.filters.years}
        provinces={data.filters.provinces}
        province={data.selected.province}
        views={VIEWS.map((view) => ({
          id: view.id,
          label: view.label,
          href: buildViewHref(country.slug, resolvedSearchParams, view.id),
        }))}
        activeViewId={activeView}
      />

      {activeView === "single" ? (
        <AtlasView data={data} country={country} />
      ) : activeView === "multi" ? (
        <div className={`${CONTENT} py-8`}>
          <CompareView data={data} country={country} />
        </div>
      ) : (
        <div className={`${CONTENT} pb-16 pt-8 print:px-0 print:pt-0`}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="max-w-sm print:hidden">
              <WorkspaceUnitSearch
                options={data.filters.municipalities}
                selectedId={data.selected.municipalityId}
                label={`Find a ${country.adminLabels.lower.singular.toLowerCase()}`}
              />
            </div>
            <div className="mt-8 print:mt-0">
              {brief ? (
                <BriefView brief={brief} />
              ) : (
                <p className="text-base leading-7 text-ink-muted">
                  {data.municipality.municipality} has no brief in the {data.release.year} edition.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </WorkspaceProvider>
  );
}
