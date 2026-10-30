import type { Metadata } from "next";
import Link from "next/link";

import { ARTICLE_LINK, ArticlePage, ArticleSection, PROSE } from "@/components/layout/article";
import { getCountryBySlug } from "@/lib/countries";
import { loadCountryDataset } from "@/lib/country-landing-data";
import { scoreComponentIndicatorMappings } from "@/lib/data/labels";
import { getAllReleaseMetadata, getGlobalReleaseSummary } from "@/lib/release-metadata";

export const metadata: Metadata = {
  title: "About | Local Development Tracker",
  description: "Why the Local Development Tracker exists, what it does, who built it, and how to cite it.",
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * A short About, per the page patterns report: why the tool exists, what it does, who built it,
 * and how to cite it. The longer QuickStart note lives under Resources, as published.
 */
export default async function AboutPage() {
  const summary = getGlobalReleaseSummary();
  const releases = [...getAllReleaseMetadata()].sort((a, b) => a.countryName.localeCompare(b.countryName));
  const example = releases.find((release) => release.countrySlug === "nepal") ?? releases[0];
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(releases.map((release) => release.countryName));
  const exampleCountry = getCountryBySlug(example.countrySlug);
  const exampleDataset = exampleCountry ? await loadCountryDataset(exampleCountry) : null;

  return (
    <ArticlePage
      kicker="About"
      title="About the Local Development Tracker"
      lede={
        <p>
          The LDT is designed to identify key development and public investment gaps at sub-national levels. It scores{" "}
          {summary.totalLoadedLocalUnits.toLocaleString("en-US")} local governments in {names} on Prosperity, Infrastructure, and Livability, using
          satellite and open data.
        </p>
      }
    >
      <ArticleSection id="why" title="Why it exists">
        <div className={PROSE}>
          <p>
            Sub-national governments are vital to realizing frontline development outcomes, including territorial development and job creation. Yet
            relevant SNG levels, population size, and geographic scale vary substantially across countries.
          </p>
          <p>
            Statistical and administrative data concerning key development indicators may be missing or outdated. SNGs may also lack local development
            strategies that best address their challenges and opportunities. Big data from non-traditional and geospatial sources, including satellites,
            can help address these gaps.
          </p>
        </div>
      </ArticleSection>

      <ArticleSection id="what" title="What it does">
        <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[17px] leading-[1.75] text-ink marker:text-ink-muted">
          <li>
            Scores every local government from 0 to 100 on three pillars built from {Object.keys(scoreComponentIndicatorMappings).length} components, using
            the same method in every country.
          </li>
          <li>Maps the scores, ranks units within their country, and compares them on any two scores at once.</li>
          <li>
            Writes a planning brief for each local government: its scores against national and province averages, and, once a reviewer has checked
            them, the commitments its local plan makes.
          </li>
          <li>Publishes every score as a CSV file, with the indicators and their sources.</li>
        </ul>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-base">
          <Link href="/resources/user-guide" className={ARTICLE_LINK}>
            User guide
          </Link>
          <Link href="/methodology" className={ARTICLE_LINK}>
            How the scores are made
          </Link>
          <Link href="/data-updates" className={ARTICLE_LINK}>
            Data updates
          </Link>
        </p>
      </ArticleSection>

      <ArticleSection id="who" title="Who built it">
        <div className={PROSE}>
          <p>
            The LDT is one of the pim-pam.net Geospatial Planning and Budgeting tools, built by the World Bank Global PIM-PAM Solutions Team: Kai-Alexander
            Kaiser, Hyunseok Kim, Fabienne Mroczka, and Kaushiki Singh.
          </p>
          <p>
            The team thanks the global partners of the World Bank Financial Management Umbrella Program and the Japan Quality of Infrastructure Investment
            Partnership program for supporting this work.
          </p>
          <p>
            Country teams interested in applying these approaches may schedule a 3-4 hour GPB LDT Masterclass, apply the tools in their country context, or
            request a tailored briefing on related Infrastructure Governance 2.0 diagnostics and other pim-pam.net digital tools.
          </p>
        </div>
      </ArticleSection>

      <ArticleSection id="cite" title="How to cite">
        <div className={PROSE}>
          <p>Name the country&apos;s edition and the date of its data, shown on each country page and under Data updates. For example:</p>
        </div>
        <p className="mt-4 max-w-[68ch] border-l-2 border-[var(--border-strong)] pl-4 text-base leading-7 text-ink">
          Local Development Tracker, {example.countryName} edition {example.releaseKey} ({example.methodologyVersion})
          {exampleDataset ? `, data as of ${formatDate(exampleDataset.generatedAt)}` : ""}. World Bank Global PIM-PAM Solutions Team.
        </p>
      </ArticleSection>

      <ArticleSection id="more" title="More to read">
        <ul className="max-w-[68ch] space-y-2 text-base leading-7">
          <li>
            <Link href="/resources/quickstart" className={ARTICLE_LINK}>
              Local Development Tracker QuickStart
            </Link>
            <span className="text-ink-muted">: the May 2026 note on the motivation, method, and early country applications.</span>
          </li>
          <li>
            <Link href="/resources" className={ARTICLE_LINK}>
              Data and documents
            </Link>
            <span className="text-ink-muted">: the scores to download, with briefings, decks, and country materials.</span>
          </li>
        </ul>
      </ArticleSection>
    </ArticlePage>
  );
}
