import { Download } from "lucide-react";
import Link from "next/link";

import { Delta, ScoreStrip } from "@/components/analytics/brief/brief-charts";
import { PrintButton } from "@/components/country/print-button";
import { ARTICLE_LINK } from "@/components/layout/article";
import { MapUnitLinks } from "@/components/maps/map-unit-links";
import { PillarMapSwitch } from "@/components/maps/pillar-map-switch";
import { buttonVariants } from "@/components/ui/button";
import { formatScore } from "@/lib/analytics/derive";
import type { Country } from "@/lib/countries";
import { buildCountryHomeModel } from "@/lib/country-home";
import { getCountryWorkspaceLinks } from "@/lib/country-landing-actions";
import { loadCountryDataset, loadLocalPlanSources } from "@/lib/country-landing-data";
import { getCountryPillarSummaries, type CountryPillarSummary } from "@/lib/country-page";
import { buildCountryTrustModel } from "@/lib/country-trust";
import { PILLAR_MAP_CLASSES, getPillarMap, pillarMapStyles } from "@/lib/maps/pillar-maps";
import { getReleaseMetadataBySlug } from "@/lib/release-metadata";
import { cn } from "@/lib/utils";

const lower = (text: string) => text.toLowerCase();
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const unitHref = (country: Country, compositeKey: string) => `/${country.slug}/analytics?tab=single&municipality=${encodeURIComponent(compositeKey)}`;

/** One pillar in the strip: the national median, its comparable change, and every unit as a tick. */
function PillarSummary({ pillar, unitPlural }: { pillar: CountryPillarSummary; unitPlural: string }) {
  const { change } = pillar;
  return (
    <li className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: pillar.color }} />
        {pillar.label}
      </p>
      <p className="mt-3 flex items-end justify-between gap-4">
        <span className="font-heading text-4xl leading-none font-semibold tabular-nums text-ink">{formatScore(pillar.median, 1)}</span>
        <span className="text-right text-xs leading-5 text-ink-muted">Median of {pillar.distribution.length.toLocaleString("en-US")} {unitPlural}</span>
      </p>
      <div className="mt-4">
        <ScoreStrip distribution={pillar.distribution} value={null} national={pillar.median} province={null} color={pillar.color} />
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-muted">
        {change.points !== null ? (
          <>
            <Delta value={change.points} className="font-medium" /> median change since {change.previousYear}, across {change.comparedUnits.toLocaleString("en-US")} of{" "}
            {change.totalUnits.toLocaleString("en-US")} {unitPlural} whose data compare
          </>
        ) : change.previousYear !== null ? (
          <>
            No change shown since {change.previousYear}: {change.changedComponents.slice(0, 2).join(" and ") || "data coverage"}
            {change.changedComponents.length > 0 ? " were not recorded the same way" : " changed"} for most {unitPlural}.
          </>
        ) : (
          "Only one year of data."
        )}
      </p>
    </li>
  );
}

function RankList({ title, rows, total, country }: { title: string; rows: CountryPillarSummary["highest"]; total: number; country: Country }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      <ol className="mt-1.5">
        {rows.map((row) => (
          <li key={row.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-baseline gap-2 border-t border-[var(--border-soft)] py-1.5 text-sm">
            <span className="text-right text-xs tabular-nums text-ink-muted">
              {row.rank}
              <span className="sr-only"> of {total}</span>
            </span>
            <Link href={unitHref(country, row.compositeKey)} className={cn(ARTICLE_LINK, "truncate no-underline hover:underline")}>
              {row.name}
            </Link>
            <span className="text-right tabular-nums text-ink">{formatScore(row.value, 1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * A country's overview, in the order the UNDP and EPI country pages use: when the data is from
 * and how to take it away, then the scores with their change, then where each unit sits, then
 * the highest and lowest units, then what the data is.
 */
export async function CountryLandingPage({ country }: { country: Country }) {
  const [dataset, summaries, map, planSources] = await Promise.all([
    loadCountryDataset(country),
    getCountryPillarSummaries(country),
    getPillarMap(country, 880, 560, 1.3),
    loadLocalPlanSources(country),
  ]);
  const release = getReleaseMetadataBySlug(country.slug);
  const model = buildCountryHomeModel(country, dataset);
  const trust = release ? buildCountryTrustModel({ country, releaseMetadata: release, groups: model.groups, planSources }) : null;
  const unitPlural = lower(country.adminLabels.lower.plural);
  const higherPlural = lower(country.adminLabels.higher.plural);
  const years = summaries.years;
  const guide = country.adminLevelGuide;
  const context = country.profile.context;
  const workspaceLinks = getCountryWorkspaceLinks(country);

  return (
    <main className="flex-1">
      <style>{pillarMapStyles()}</style>
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 pb-20 sm:px-6 lg:px-10 lg:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <h1 className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl">{country.name}</h1>
            <p className="mt-3 text-base text-ink">
              {model.lowerCount.toLocaleString("en-US")} {unitPlural} in {model.higherCount} {higherPlural}
              <span className="text-ink-muted">
                {" "}
                · {model.populationLabel} people · {model.areaLabel}
              </span>
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Data as of {formatDate(summaries.generatedAt)} · edition {dataset.release.key} · {years[0]} to {years.at(-1)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <a href={`/api/countries/${country.slug}/scores`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden data-icon="inline-start" />
              Download CSV
            </a>
            <PrintButton />
          </div>
        </header>

        <nav aria-label={`${country.name} workspace`} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 print:hidden">
          {workspaceLinks.map((link) => (
            <Link key={link.href} href={link.href} className={link.primary ? buttonVariants({ size: "sm" }) : cn(ARTICLE_LINK, "text-sm")}>
              {link.label}
            </Link>
          ))}
        </nav>

        <section aria-labelledby="country-scores" className="mt-10">
          <h2 id="country-scores" className="sr-only">
            Scores
          </h2>
          <ul className="grid divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)] md:grid-cols-3 md:divide-x md:divide-y-0">
            {summaries.pillars.map((pillar) => (
              <PillarSummary key={pillar.key} pillar={pillar} unitPlural={unitPlural} />
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">Each tick is one {lower(country.adminLabels.lower.singular)}; the tall line is the median. Scores run from 0 to 100.</p>
        </section>

        <section aria-labelledby="country-map" className="mt-14 border-t border-[var(--border-soft)] pt-6">
          <h2 id="country-map" className="font-heading text-2xl leading-tight font-semibold text-ink">
            Where each {lower(country.adminLabels.lower.singular)} stands
          </h2>
          <div className="mt-4">
            <PillarMapSwitch classes={PILLAR_MAP_CLASSES} name="country-pillar" note={`Fifths of ${country.name}'s ${unitPlural}`}>
              <MapUnitLinks hrefBase={unitHref(country, "")}>
                <svg viewBox={`0 0 ${map.width} ${map.height}`} className="mx-auto mt-6 block h-auto max-h-[38rem] w-full" role="img" aria-labelledby="country-map-title">
                  <title id="country-map-title">{`Map of ${country.name}'s ${unitPlural}, colored by fifths of the chosen score. Select a ${lower(country.adminLabels.lower.singular)} to open it in the map; the lists below link to every one.`}</title>
                  {map.units.map((unit) => (
                    <path key={unit.key} d={unit.d} data-k={unit.key} data-p={unit.classes.prosperity} data-i={unit.classes.infrastructure} data-l={unit.classes.livability}>
                      <title>{unit.name}</title>
                    </path>
                  ))}
                </svg>
              </MapUnitLinks>
            </PillarMapSwitch>
          </div>
        </section>

        <section aria-labelledby="country-ranks" className="mt-14 border-t border-[var(--border-soft)] pt-6">
          <h2 id="country-ranks" className="font-heading text-2xl leading-tight font-semibold text-ink">
            Highest and lowest
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Ranks among {country.name}&apos;s {unitPlural} in {dataset.release.year}; tied scores share a rank.
          </p>
          <div className="mt-6 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {summaries.pillars.map((pillar) => (
              <div key={pillar.key}>
                <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: pillar.color }} />
                  {pillar.label}
                </h3>
                <div className="mt-3 space-y-5">
                  <RankList title="Highest" rows={pillar.highest} total={pillar.rankedCount} country={country} />
                  <RankList title="Lowest" rows={pillar.lowest} total={pillar.rankedCount} country={country} />
                </div>
                <Link href={`/${country.slug}/analytics?tab=single&metric=${pillar.scoreId}`} className={cn(ARTICLE_LINK, "mt-3 inline-block text-sm print:hidden")}>
                  Full ranking of {pillar.rankedCount.toLocaleString("en-US")}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="country-about" className="mt-16 border-t border-[var(--border-soft)] pt-6">
          <h2 id="country-about" className="font-heading text-2xl leading-tight font-semibold text-ink">
            About this data
          </h2>
          <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <dl className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)] text-sm">
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2.5">
                  <dt className="text-ink-muted">Edition</dt>
                  <dd className="text-ink">
                    {dataset.release.key}, {release?.methodologyVersion ?? "PIL"}
                  </dd>
                </div>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2.5">
                  <dt className="text-ink-muted">Years</dt>
                  <dd className="text-ink">{years.join(", ")}</dd>
                </div>
                {trust?.items.map((item) => (
                  <div key={item.label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2.5">
                    <dt className="text-ink-muted">{item.label}</dt>
                    <dd className="text-ink">
                      {item.value}
                      <span className="block text-xs text-ink-muted">{item.detail}</span>
                    </dd>
                  </div>
                ))}
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2.5">
                  <dt className="text-ink-muted">National plan</dt>
                  <dd>
                    <a href={country.profile.strategy.url} target="_blank" rel="noreferrer" className={ARTICLE_LINK}>
                      {country.profile.strategy.title}
                    </a>
                  </dd>
                </div>
              </dl>
              {trust && trust.caveats.length > 0 ? (
                <>
                  <h3 className="mt-8 text-sm font-semibold text-ink">Caveats</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink marker:text-ink-muted">
                    {trust.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm print:hidden">
                <Link href="/methodology" className={ARTICLE_LINK}>
                  How the scores are made
                </Link>
                <Link href="/data-updates" className={ARTICLE_LINK}>
                  Data updates
                </Link>
              </p>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-ink">{country.name} in context</h3>
                <p className="mt-2 text-sm leading-6 text-ink">{context.summary}</p>
                {context.highlights.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink marker:text-ink-muted">
                    {context.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Administrative levels</h3>
                <p className="mt-2 text-sm leading-6 text-ink">{guide.summary}</p>
                <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {guide.levels.map((level) => (
                    <div key={`${level.label}-${level.name}`} className="border-t border-[var(--border-soft)] pt-2">
                      <dt className="text-sm font-medium text-ink">
                        {level.name} <span className="font-normal text-ink-muted">({level.label})</span>
                      </dt>
                      <dd className="mt-1 text-sm leading-6 text-ink-muted">{level.description}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{guide.note}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Sources</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {[...context.sourceLinks, ...guide.sourceLinks].map((source) => (
                    <li key={source.href}>
                      <a href={source.href} target="_blank" rel="noreferrer" className={ARTICLE_LINK}>
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
