import Link from "next/link";

import { ARTICLE_LINK, PROSE } from "@/components/layout/article";
import { InventoryTable } from "@/components/strategy-inventory/inventory-table";
import { StatusMarker } from "@/components/strategy-inventory/status-marker";
import type { Country } from "@/lib/countries";
import { STATUS_COLORS, STATUS_LABELS, coversYear, toInventoryRow } from "@/lib/strategy-inventory/public";
import { getReadinessCategory, getStrategyInventoryDisplaySummary } from "@/lib/strategy-inventory/summarize";
import type { PublicationYearCount, ReadinessCategory, StrategyInventoryDataset } from "@/lib/strategy-inventory/types";
import { cn } from "@/lib/utils";

const formatDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

function statusMeaning(status: ReadinessCategory, unit: string) {
  switch (status) {
    case "AI-ready":
      return `The PDF downloaded, its text was read, and an automatic check matched it to the ${unit}.`;
    case "Found / Not Parsed":
      return "There is a link, but the document has not been read yet.";
    case "Needs Translation":
      return "The text was read, but it needs translating before it can be used.";
    case "Needs Validation":
      return `The link failed, the PDF is a scan, or the automatic check could not match it to the ${unit}.`;
    case "Missing":
      return `The source list has no link for this ${unit}.`;
  }
}

function Stat({ value, total, label, note }: { value: number; total?: number; label: string; note: string }) {
  return (
    <li className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-heading text-4xl leading-none font-semibold tabular-nums text-ink">{value.toLocaleString("en-US")}</span>
        {total !== undefined ? <span className="text-base text-ink-muted tabular-nums">of {total.toLocaleString("en-US")}</span> : null}
      </p>
      {total ? (
        <div aria-hidden="true" className="mt-4 h-1.5 w-full rounded-full bg-[var(--surface-muted)]">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-ink-muted">{note}</p>
    </li>
  );
}

/** Documents per publication year, with empty years kept so the spacing is honest. */
function YearColumns({ counts }: { counts: readonly PublicationYearCount[] }) {
  const known = counts.filter((entry) => entry.year !== "Unknown").map((entry) => ({ year: Number(entry.year), count: entry.count }));
  if (known.length === 0) return <p className="text-sm text-ink-muted">No publication years are recorded.</p>;
  const byYear = new Map(known.map((entry) => [entry.year, entry.count]));
  const first = known[0].year;
  const last = known.at(-1)!.year;
  const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const max = Math.max(...known.map((entry) => entry.count));

  return (
    <ol className="flex h-44 items-end gap-1 border-b border-[var(--border-strong)] sm:gap-1.5">
      {years.map((year, index) => {
        const count = byYear.get(year) ?? 0;
        // Past eight columns, phones label every fifth year and the last, unless the last sits too close to a labelled one.
        const phoneLabel = years.length <= 8 || index === years.length - 1 || (index % 5 === 0 && years.length - 1 - index >= 3);
        return (
          <li key={year} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="sr-only">
              {year}: {count} {count === 1 ? "document" : "documents"}
            </span>
            <span aria-hidden="true" className="mb-1 text-center text-[11px] leading-none tabular-nums text-ink-muted">
              {count > 0 ? count : ""}
            </span>
            <span aria-hidden="true" className="mx-auto block w-full max-w-12 rounded-t-[2px] bg-accent" style={{ height: `${(count / max) * 80}%` }} />
            <span aria-hidden="true" className={cn("relative h-0 text-center text-[11px] tabular-nums text-ink-muted", !phoneLabel && "invisible sm:visible")}>
              <span className="absolute inset-x-[-1rem] top-1.5">{year}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A country's local plan documents: how many units have one, how far each got, when they were
 * published, and every unit in a table. Records' notes stay on the server: the table gets rows built
 * by toInventoryRow, which keep only fixed sentences.
 */
export function StrategyInventoryDashboard({ dataset, country }: { dataset: StrategyInventoryDataset; country: Country }) {
  const summary = getStrategyInventoryDisplaySummary(dataset.records, dataset.expected_lsg_count, dataset.summary_override);
  const unit = country.adminLabels.lower.singular.toLowerCase();
  const unitPlural = country.adminLabels.lower.plural.toLowerCase();
  const checked = summary.latest_last_updated ?? dataset.last_updated;
  const year = Number(checked.slice(0, 4));
  const rows = dataset.records.map((record) => toInventoryRow(record, getReadinessCategory(record), unit));
  const covering = dataset.records.filter((record) => coversYear(record, year)).length;
  const breakdown = summary.status_breakdown.filter((entry) => entry.count > 0);
  const breakdownTotal = breakdown.reduce((sum, entry) => sum + entry.count, 0);
  const unknownYears = summary.unknown_year_count;
  const serbian = dataset.country_code === "SRB";

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 pb-20 sm:px-6 lg:px-10 lg:pt-14">
        <header>
          <Link href={`/${country.slug}`} className={cn(ARTICLE_LINK, "text-sm font-medium no-underline hover:underline")}>
            {country.name}
          </Link>
          <h1 className="mt-2 font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl">Strategy inventory</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-ink">
            Local development plans for {country.name}&apos;s {summary.expected_lsgs.toLocaleString("en-US")} {unitPlural}: whether there is a link to one,
            the years it covers, and whether its text could be read.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Links checked {formatDate(checked)}
            {dataset.is_sample_data ? " · Sample records for preview, not the full inventory" : null}
          </p>
        </header>

        <section aria-labelledby="inventory-totals" className="mt-10">
          <h2 id="inventory-totals" className="sr-only">
            Totals
          </h2>
          <ul className="grid divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)] md:grid-cols-3 md:divide-x md:divide-y-0">
            <Stat
              label="Have a plan link"
              value={summary.lsgs_with_any_document}
              total={summary.expected_lsgs}
              note={`${formatPercent(summary.coverage_rate)} of ${unitPlural} have at least one link to a plan, working or not.`}
            />
            <Stat
              label="Text read"
              value={summary.ai_ready_documents}
              total={summary.total_documents_found}
              note={`Linked documents whose text was read and matched to the ${unit}.`}
            />
            <Stat
              label={`Cover ${year}`}
              value={covering}
              total={summary.expected_lsgs}
              note={`Plans whose stated years include ${year}. A plan with no end year does not count.`}
            />
          </ul>
        </section>

        <div className="mt-14 grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section aria-labelledby="inventory-status" className="border-t border-[var(--border-soft)] pt-6">
            <h2 id="inventory-status" className="font-heading text-2xl leading-tight font-semibold text-ink">
              Where each document stands
            </h2>
            <div aria-hidden="true" className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-[2px]">
              {breakdown.map((entry) => (
                <span key={entry.category} className="h-full" style={{ width: `${(entry.count / breakdownTotal) * 100}%`, backgroundColor: STATUS_COLORS[entry.category] }} />
              ))}
            </div>
            <ul className="mt-5">
              {breakdown.map((entry) => (
                <li key={entry.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 border-t border-[var(--border-soft)] py-2.5 first:border-t-0">
                  <span>
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <StatusMarker status={entry.category} />
                      {STATUS_LABELS[entry.category]}
                    </span>
                    {/* Indented past the 10px dot and its 8px gap. */}
                    <span className="block pl-[18px] text-xs leading-5 text-ink-muted">{statusMeaning(entry.category, unit)}</span>
                  </span>
                  <span className="text-right text-sm font-medium tabular-nums text-ink">
                    {entry.count}
                    <span className="block text-xs font-normal text-ink-muted">{formatPercent(entry.count / breakdownTotal)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="inventory-years" className="border-t border-[var(--border-soft)] pt-6">
            <h2 id="inventory-years" className="font-heading text-2xl leading-tight font-semibold text-ink">
              Year published
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Linked documents by the year they were published.</p>
            <div className="mt-6 pb-6">
              <YearColumns counts={summary.publication_year_counts} />
            </div>
            {unknownYears > 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                {unknownYears} of {summary.total_documents_found} linked documents have no publication year recorded.
              </p>
            ) : null}
          </section>
        </div>

        <section aria-labelledby="inventory-table" className="mt-14 border-t border-[var(--border-soft)] pt-6">
          <h2 id="inventory-table" className="font-heading text-2xl leading-tight font-semibold text-ink">
            Every {unit}
          </h2>
          <div className="mt-5">
            <InventoryTable
              rows={rows}
              unitSingular={unit}
              unitPlural={unitPlural}
              regionLabel={country.adminLabels.higher.singular}
              localLang={serbian ? "sr" : undefined}
            />
          </div>
        </section>

        <section aria-labelledby="inventory-about" className="mt-16 border-t border-[var(--border-soft)] pt-6">
          <h2 id="inventory-about" className="font-heading text-2xl leading-tight font-semibold text-ink">
            About this inventory
          </h2>
          <div className={cn(PROSE, "mt-4 text-base leading-7")}>
            <p>
              The links come from the team&apos;s list of local development plans. On {formatDate(checked)} an automatic pass downloaded each link,
              read the text of its first pages, and checked that the document is a development plan for that {unit}. Nobody has checked the results by
              hand yet, so a status can be wrong.
            </p>
            <p>
              Coverage counts {unitPlural} with at least one link, so a {unit} whose only link failed still counts. The years in the table are the ones a
              plan states it covers; where it states none, the table gives the year it was published.
              {serbian ? " Plans in Serbian count as read without translation." : null}
            </p>
            <p>
              Return to the{" "}
              <Link href={`/${country.slug}`} className={ARTICLE_LINK}>
                {country.name} page
              </Link>{" "}
              for the scores.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
