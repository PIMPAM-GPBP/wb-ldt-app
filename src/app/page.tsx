import Link from "next/link";

import { PillarMapSwitch } from "@/components/maps/pillar-map-switch";
import { countries } from "@/lib/countries";
import { PILLAR_MAP_CLASSES, getPillarMap, pillarMapStyles } from "@/lib/maps/pillar-maps";
import { getAllReleaseMetadata, getGlobalReleaseSummary } from "@/lib/release-metadata";

const LINK =
  "rounded-sm text-accent underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";

/**
 * The home page leads with the places measured: one small map per country, colored by the
 * same pillar, with each country's unit count and the ways into its data.
 */
export default async function Home() {
  const releaseSummary = getGlobalReleaseSummary();
  const releases = [...getAllReleaseMetadata()].sort((a, b) => a.countryName.localeCompare(b.countryName));
  const live = countries.filter((country) => country.analyticsStatus === "live");
  const maps = new Map((await Promise.all(live.map((country) => getPillarMap(country, 420, 320)))).map((map) => [map.slug, map]));
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(releases.map((release) => release.countryName));

  return (
    <main className="flex-1">
      <style>{pillarMapStyles()}</style>
      <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-20 sm:px-6 lg:px-10 lg:pt-20">
        <h1 className="max-w-4xl font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
          Local development scores for {releaseSummary.totalLoadedLocalUnits.toLocaleString("en-US")} local governments in {names}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">
          Each one is scored from 0 to 100 on Prosperity, Infrastructure, and Livability, using satellite and open data. Open a country to map
          the scores, compare places, and read a planning brief for any of them.
        </p>

        <section aria-label="Countries" className="mt-14 border-t border-[var(--border-soft)] pt-6">
          <PillarMapSwitch classes={PILLAR_MAP_CLASSES} name="home-pillar" note="Fifths of units within each country">
            <ul className="mt-8 grid gap-x-10 gap-y-14 md:grid-cols-3">
              {releases.map((release) => {
                const country = countries.find((entry) => entry.slug === release.countrySlug);
                const map = maps.get(release.countrySlug);
                const unitPlural = country?.adminLabels.lower.plural.toLowerCase() ?? "local governments";
                return (
                  <li key={release.countrySlug}>
                    <Link
                      href={`/${release.countrySlug}`}
                      className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:outline-solid"
                    >
                      <div className="flex h-56 items-center justify-center sm:h-64">
                        {map ? (
                          <svg aria-hidden="true" viewBox={`0 0 ${map.width} ${map.height}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
                            {map.units.map((unit) => (
                              <path key={unit.key} d={unit.d} data-p={unit.classes.prosperity} data-i={unit.classes.infrastructure} data-l={unit.classes.livability} />
                            ))}
                          </svg>
                        ) : null}
                      </div>
                      <h2 className="mt-5 font-heading text-2xl leading-tight font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                        {release.countryName}
                      </h2>
                    </Link>
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="font-heading text-base font-semibold tabular-nums text-ink">{release.analyticsMunicipalityCount.toLocaleString("en-US")}</span>{" "}
                      {unitPlural} · {release.latestDataYear} data
                    </p>
                    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <Link href={`/${release.countrySlug}/analytics`} className={LINK}>
                        Map
                      </Link>
                      <Link href={`/${release.countrySlug}/analytics?tab=multi`} className={LINK}>
                        Compare
                      </Link>
                      <Link href={`/${release.countrySlug}/analytics?tab=brief`} className={LINK}>
                        Planning briefs
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          </PillarMapSwitch>
        </section>

        <p className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border-soft)] pt-6 text-sm">
          <Link href="/methodology" className={LINK}>
            How the scores are made
          </Link>
          <Link href="/about" className={LINK}>
            About the Local Development Tracker
          </Link>
          <Link href="/resources" className={LINK}>
            Documents and country materials
          </Link>
        </p>
      </div>
    </main>
  );
}
