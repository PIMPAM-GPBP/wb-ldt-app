import type { Metadata } from "next";
import Link from "next/link";

import { ARTICLE_LINK, ArticlePage, ArticleSection, PROSE } from "@/components/layout/article";
import { countries } from "@/lib/countries";
import { getCountryPillarSummaries } from "@/lib/country-page";
import { getAllReleaseMetadata } from "@/lib/release-metadata";

export const metadata: Metadata = {
  title: "Data updates | Local Development Tracker",
  description: "Which data editions the LDT shows, whether their years compare, known data issues, and dated changes to the data.",
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Dated changes to the data itself, newest first. Software changes are kept in docs/release-history.md. */
const UPDATES = [
  {
    date: "15 June 2026",
    title: "All three editions regenerated",
    body: "The Nepal, Serbia, and Zambia editions were regenerated from the score tables, with every year from 2021 to 2025.",
  },
  {
    date: "12 June 2026",
    title: "Serbia and Zambia added",
    body: "Serbia's 161 municipalities and Zambia's 116 districts were added with their scores, components, context data, and boundaries.",
  },
  {
    date: "18 May 2026",
    title: "Nepal published",
    body: "Nepal's municipality scores, score components, and context data were published, with the municipality boundaries.",
  },
];

export default async function DataUpdatesPage() {
  const releases = [...getAllReleaseMetadata()].sort((a, b) => a.countryName.localeCompare(b.countryName));
  const live = countries.filter((country) => country.analyticsStatus === "live").sort((a, b) => a.name.localeCompare(b.name));
  const summaries = await Promise.all(live.map(async (country) => ({ country, ...(await getCountryPillarSummaries(country)) })));

  return (
    <ArticlePage
      kicker="Data updates"
      title="What changed in the data, and when"
      lede={
        <p>
          The editions the LDT shows, whether their years compare, the known issues in the data, and dated changes, newest first. Each entry is about the
          data; changes to the website are not listed.
        </p>
      }
    >
      <ArticleSection id="editions" title="Current editions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-strong)] text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Country</th>
                <th scope="col" className="py-2 pr-4 font-medium">Edition</th>
                <th scope="col" className="py-2 pr-4 font-medium">Years</th>
                <th scope="col" className="py-2 pr-4 font-medium">Units</th>
                <th scope="col" className="py-2 font-medium">Data as of</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((release) => {
                const summary = summaries.find((entry) => entry.country.slug === release.countrySlug);
                const country = summary?.country;
                return (
                  <tr key={release.releaseKey} className="border-b border-[var(--border-soft)] text-ink">
                    <th scope="row" className="py-3 pr-4 font-semibold">
                      <Link href={`/${release.countrySlug}`} className={ARTICLE_LINK}>
                        {release.countryName}
                      </Link>
                    </th>
                    <td className="py-3 pr-4 tabular-nums">
                      {release.releaseKey}, {release.methodologyVersion}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {release.availableYears[0]} to {release.availableYears.at(-1)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {release.analyticsMunicipalityCount.toLocaleString("en-US")} {country?.adminLabels.lower.plural.toLowerCase()}
                    </td>
                    <td className="py-3 tabular-nums">{summary ? formatDate(summary.generatedAt) : "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ArticleSection>

      <ArticleSection
        id="comparability"
        title="Do the years compare?"
        intro={
          <p>
            A score moves between years for two reasons: the place changed, or a component started or stopped being recorded. The LDT counts a change only
            for units whose components were recorded the same way in both years. The table shows how many units that leaves between the last two years.
          </p>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-strong)] text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Country</th>
                <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                <th scope="col" className="py-2 pr-4 font-medium">Units that compare</th>
                <th scope="col" className="py-2 font-medium">Components recorded differently</th>
              </tr>
            </thead>
            <tbody>
              {summaries.flatMap(({ country, pillars, years }) =>
                pillars.map((pillar, index) => (
                  <tr key={`${country.slug}-${pillar.key}`} className="border-b border-[var(--border-soft)] align-top text-ink">
                    <th scope="row" className="py-2.5 pr-4 font-semibold">
                      {index === 0 ? country.name : <span className="sr-only">{country.name}</span>}
                    </th>
                    <td className="py-2.5 pr-4">{pillar.label}</td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {pillar.change.comparedUnits.toLocaleString("en-US")} of {pillar.change.totalUnits.toLocaleString("en-US")}, {pillar.change.previousYear} to {years.at(-1)}
                      <span className="block text-xs text-ink-muted">{pillar.change.points === null ? "Too few to show a change" : "Change shown on the country page"}</span>
                    </td>
                    <td className="py-2.5 text-ink-muted">{pillar.change.changedComponents.join(", ") || "None"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </ArticleSection>

      <ArticleSection id="known-issues" title="Known data issues">
        <div className={PROSE}>
          <p>
            Where a component has nothing recorded for a unit, the score tables count a fixed value for it rather than leaving it out. Planning briefs
            mark those components as not recorded and never compare them.
          </p>
          <p>
            Road and railway flood and heat risks are recorded only for 2025, so Livability scores from earlier years do not compare with 2025.
          </p>
          <p>
            Nepal&apos;s source data holds 806 units, of which 55 are slivers left by overlaying two boundary sets. The LDT counts, ranks, and averages the 751
            municipalities with a boundary.
          </p>
          <p>
            The source metadata swaps the descriptions of the Road Heatwave, Road Flood, and Railway Heatwave indicators. The methodology page shows corrected
            descriptions; the map&apos;s indicator panel shows the source&apos;s until it is corrected.
          </p>
        </div>
      </ArticleSection>

      <ArticleSection id="updates" title="Updates">
        <ol>
          {UPDATES.map((update) => (
            <li key={update.date + update.title} className="grid gap-x-10 gap-y-1 border-t border-[var(--border-soft)] py-5 md:grid-cols-[10rem_minmax(0,1fr)]">
              <p className="text-sm tabular-nums text-ink-muted md:pt-0.5">{update.date}</p>
              <div className="max-w-[68ch]">
                <h3 className="font-heading text-lg font-semibold text-ink">{update.title}</h3>
                <p className="mt-1 text-base leading-7 text-ink">{update.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-ink-muted">
          How the scores are built is on the{" "}
          <Link href="/methodology" className={ARTICLE_LINK}>
            methodology
          </Link>{" "}
          page.
        </p>
      </ArticleSection>
    </ArticlePage>
  );
}
