import type { Metadata } from "next";
import Link from "next/link";

import { ARTICLE_LINK, ArticlePage, ArticleSection, PROSE } from "@/components/layout/article";
import { formatBytes, getDownloads, type Download } from "@/lib/downloads";
import { countryResourcePacks, ldtResourceFiles, type ResourceFile } from "@/lib/resources";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data and documents | Local Development Tracker",
  description: "Download the LDT's scores, indicators, and boundaries for every country, and the guides, briefings, and country materials about it.",
};

const TOC = [
  { id: "scores", label: "Scores" },
  { id: "indicators", label: "Indicators and boundaries" },
  { id: "using", label: "Using the data" },
  { id: "guides", label: "Guides" },
  { id: "documents", label: "Core LDT materials" },
  { id: "countries", label: "Country materials" },
];

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function FileLink({ file, label }: { file: Download; label?: string }) {
  return (
    <a href={file.href} download={file.fileName} className={ARTICLE_LINK}>
      {label ?? file.fileName}
      <span className="sr-only">
        , {file.format}, {formatBytes(file.bytes)}
      </span>
    </a>
  );
}

/** A document as a row: title link, format, and one line on what it is for. */
function ResourceRow({ resource }: { resource: ResourceFile }) {
  return (
    <li className="grid gap-x-8 gap-y-1 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div>
        <p className="text-xs font-medium text-ink-muted">{resource.format}</p>
        <a href={resource.href} target="_blank" rel="noreferrer" className={cn(ARTICLE_LINK, "mt-1 inline-block font-heading text-lg leading-snug font-semibold")}>
          {resource.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="text-base leading-7 text-ink md:pt-5">{resource.description}</p>
    </li>
  );
}

export default async function ResourcesPage() {
  const downloads = await getDownloads();
  return (
    <ArticlePage
      kicker="Data"
      title="Data and documents"
      lede={
        <p>
          The scores, indicators, and boundaries behind the LDT for every country, followed by the guides, briefings, and country materials about it.
        </p>
      }
      toc={TOC}
    >
      <ArticleSection
        id="scores"
        title="Scores"
        intro={<p>Every unit&apos;s three scores and their components, for every year in the edition, with one row per unit and year.</p>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-strong)] text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Country</th>
                <th scope="col" className="py-2 pr-4 font-medium">File</th>
                <th scope="col" className="py-2 pr-4 font-medium">Edition</th>
                <th scope="col" className="py-2 pr-4 font-medium">Rows</th>
                <th scope="col" className="py-2 font-medium">Data as of</th>
              </tr>
            </thead>
            <tbody>
              {downloads.countries.map((entry) => (
                <tr key={entry.country.slug} className="border-b border-[var(--border-soft)] align-top text-ink">
                  <th scope="row" className="py-3 pr-4 font-semibold">
                    <Link href={`/${entry.country.slug}`} className={ARTICLE_LINK}>
                      {entry.country.name}
                    </Link>
                  </th>
                  <td className="py-3 pr-4">
                    <FileLink file={entry.scores} />
                    <span className="block text-xs text-ink-muted">
                      {entry.scores.format}, {formatBytes(entry.scores.bytes)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {entry.edition}
                    <span className="block text-xs text-ink-muted">
                      {entry.years[0]} to {entry.years.at(-1)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{entry.scores.rows?.toLocaleString("en-US")}</td>
                  <td className="py-3 tabular-nums">{formatDate(entry.generatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ArticleSection>

      <ArticleSection id="indicators" title="Indicators and boundaries">
        <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
          <li className="grid gap-x-8 gap-y-1 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <p className="text-xs font-medium text-ink-muted">
                {downloads.indicators.format}, {formatBytes(downloads.indicators.bytes)}
              </p>
              <p className="mt-1 font-heading text-lg leading-snug font-semibold">
                <FileLink file={downloads.indicators} label="Indicator list" />
              </p>
            </div>
            <p className="text-base leading-7 text-ink md:pt-5">
              All {downloads.indicators.rows} indicators: what each measures, the component it feeds, which direction scores higher, the years recorded, and
              its sources. The same list is on the{" "}
              <Link href="/methodology#indicators" className={ARTICLE_LINK}>
                methodology
              </Link>{" "}
              page.
            </p>
          </li>
          {downloads.countries.map((entry) => (
            <li key={entry.country.slug} className="grid gap-x-8 gap-y-1 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <p className="text-xs font-medium text-ink-muted">
                  {entry.boundaries.format}, {formatBytes(entry.boundaries.bytes)}
                </p>
                <p className="mt-1 font-heading text-lg leading-snug font-semibold">
                  <FileLink file={entry.boundaries} label={`${entry.country.name} boundaries`} />
                </p>
              </div>
              <p className="text-base leading-7 text-ink md:pt-5">
                The {entry.country.adminLabels.lower.plural.toLowerCase()} the map draws, keyed by the same names as the scores file.
              </p>
            </li>
          ))}
        </ul>
      </ArticleSection>

      <ArticleSection id="using" title="Using the data">
        <div className={PROSE}>
          <p>
            Name the country&apos;s edition and the date of its data when you use these files;{" "}
            <Link href="/about#cite" className={ARTICLE_LINK}>
              About
            </Link>{" "}
            shows an example. Each indicator&apos;s sources are on the methodology page, and{" "}
            <Link href="/data-updates" className={ARTICLE_LINK}>
              Data updates
            </Link>{" "}
            says which years compare and lists known issues in the data.
          </p>
        </div>
      </ArticleSection>

      <ArticleSection id="guides" title="Guides">
        <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
          {[
            { href: "/resources/user-guide", title: "User guide", format: "Web page", description: "How to find a place, read its scores, compare it with others, read its planning brief, and download the data." },
            { href: "/resources/quickstart", title: "Local Development Tracker QuickStart", format: "Web page, 23 May 2026", description: "The note on the LDT's motivation, method, and early country applications in Nepal, Serbia, and Zambia." },
          ].map((guide) => (
            <li key={guide.href} className="grid gap-x-8 gap-y-1 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <p className="text-xs font-medium text-ink-muted">{guide.format}</p>
                <Link href={guide.href} className={cn(ARTICLE_LINK, "mt-1 inline-block font-heading text-lg leading-snug font-semibold")}>
                  {guide.title}
                </Link>
              </div>
              <p className="text-base leading-7 text-ink md:pt-5">{guide.description}</p>
            </li>
          ))}
        </ul>
      </ArticleSection>

      <ArticleSection id="documents" title="Core LDT materials">
        <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
          {ldtResourceFiles.map((resource) => (
            <ResourceRow key={resource.href} resource={resource} />
          ))}
        </ul>
      </ArticleSection>

      <ArticleSection
        id="countries"
        title="Documents, demos, and analyses by country"
        intro={
          <p>
            Each workspace groups country-facing reference material in one place, with
            direct links to visible files and a folder link for anything added later.
          </p>
        }
      >
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          {countryResourcePacks.map((pack) => (
            <section key={pack.country} aria-labelledby={`pack-${pack.country}`} className="border-t border-[var(--border-strong)] pt-4">
              <h3 id={`pack-${pack.country}`} className="font-heading text-xl leading-snug font-semibold text-ink">
                {pack.title}
              </h3>
              <p className="mt-2 text-base leading-7 text-ink">{pack.description}</p>
              <a href={pack.href} target="_blank" rel="noreferrer" className={cn(ARTICLE_LINK, "mt-3 inline-block text-sm")}>
                Open country folder
                <span className="sr-only"> for {pack.country} (opens in a new tab)</span>
              </a>
              <p className="mt-6 text-xs font-medium text-ink-muted">Included materials</p>
              {pack.files.length > 0 ? (
                <ul className="mt-2 divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
                  {pack.files.map((resource) => (
                    <li key={resource.href} className="py-2.5">
                      <a href={resource.href} target="_blank" rel="noreferrer" className={cn(ARTICLE_LINK, "text-sm leading-snug")}>
                        {resource.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      <span className="mt-0.5 block text-xs text-ink-muted">{resource.format}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-ink-muted">{pack.emptyState}</p>
              )}
            </section>
          ))}
        </div>
      </ArticleSection>
    </ArticlePage>
  );
}
