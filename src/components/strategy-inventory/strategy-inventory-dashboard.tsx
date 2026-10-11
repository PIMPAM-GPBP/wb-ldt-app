"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PlotlyChart } from "@/components/analytics/plotly-chart";
import { useTheme } from "@/components/theme/theme-provider";
import { filterStrategyInventoryRecords } from "@/lib/strategy-inventory/filters";
import {
  getStrategyInventorySummary,
  getReadinessCategory,
  READINESS_CATEGORIES,
} from "@/lib/strategy-inventory/summarize";
import type {
  ReadinessCategory,
  StrategyDocumentType,
  StrategyInventoryDataset,
  StrategyInventoryFilters,
  StrategyInventoryRecord,
  StrategyInventorySummary,
  StrategyTranslationStatus,
} from "@/lib/strategy-inventory/types";

type SortKey = "lsg_name" | "publication_year" | "readiness_category";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

const documentTypeLabels: Record<StrategyDocumentType, string> = {
  strategy: "Strategy",
  budget: "Budget",
  plan: "Plan",
  other: "Other",
};

const sourceStatusLabels: Record<StrategyInventoryRecord["source_status"], string> = {
  found: "Found",
  missing: "Missing",
  not_available: "Not available",
  needs_validation: "Needs validation",
};

const translationStatusLabels: Record<StrategyTranslationStatus, string> = {
  not_required: "Not required",
  translated: "Translated",
  needs_translation: "Needs translation",
  partial: "Partial",
  unknown: "Unknown",
};

const parsingStatusLabels: Record<StrategyInventoryRecord["parsing_status"], string> = {
  not_started: "Not started",
  parsed: "Parsed",
  failed: "Failed",
  needs_review: "Needs review",
};

const readinessColors: Record<ReadinessCategory, string> = {
  "AI-ready": "#2f8f6f",
  "Found / Not Parsed": "#7d88a2",
  "Needs Translation": "#c7923e",
  "Needs Validation": "#e07a5f",
  Missing: "#b42318",
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  style: "percent",
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPublicationYear(value: number | null | undefined) {
  return Number.isFinite(value) ? String(value) : "Unknown";
}

function KpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_14px_34px_var(--surface-shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        {helper}
      </p>
    </article>
  );
}

function ReadinessBadge({ category }: { category: ReadinessCategory }) {
  return (
    <span
      className="inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: readinessColors[category],
        backgroundColor: `${readinessColors[category]}1f`,
        color: readinessColors[category],
      }}
    >
      {category}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

function compareRecords(left: StrategyInventoryRecord, right: StrategyInventoryRecord, sort: SortState) {
  const direction = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "publication_year") {
    const leftYear = left.publication_year ?? Number.POSITIVE_INFINITY;
    const rightYear = right.publication_year ?? Number.POSITIVE_INFINITY;
    return (leftYear - rightYear) * direction;
  }

  if (sort.key === "readiness_category") {
    return (
      getReadinessCategory(left).localeCompare(getReadinessCategory(right)) * direction
    );
  }

  return left.lsg_name.localeCompare(right.lsg_name) * direction;
}

function selectClassName() {
  return "h-11 rounded-full border border-[var(--border-soft)] bg-white px-4 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] dark:bg-[var(--surface-strong)]";
}

function buildYearOptions(records: StrategyInventoryRecord[]) {
  return [
    ...new Set(records.map((record) => formatPublicationYear(record.publication_year))),
  ].sort((left, right) => {
    if (left === "Unknown") return 1;
    if (right === "Unknown") return -1;
    return Number(left) - Number(right);
  });
}

function chartLayoutBase(isDark: boolean) {
  const textColor = isDark ? "#f5f7ff" : "#374291";
  const gridColor = isDark ? "rgba(201,211,234,0.1)" : "rgba(55,66,145,0.08)";
  const chartSurface = isDark ? "rgba(7,28,42,0.96)" : "#ffffff";

  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: chartSurface,
    font: { color: textColor },
    margin: { l: 56, r: 24, t: 30, b: 56 },
    xaxis: {
      gridcolor: gridColor,
      tickfont: { color: textColor },
      zerolinecolor: gridColor,
    },
    yaxis: {
      gridcolor: gridColor,
      tickfont: { color: textColor },
      zerolinecolor: gridColor,
    },
  };
}

function PublicationYearChart({
  summary,
}: {
  summary: StrategyInventorySummary;
}) {
  const { isDark } = useTheme();
  const total = Math.max(summary.total_documents_found, 1);
  const years = summary.publication_year_counts.map((entry) => entry.year);
  const counts = summary.publication_year_counts.map((entry) => entry.count);

  return (
    <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Publication timing
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            Count by Year of Publication
          </h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Unknown year: {formatNumber(summary.unknown_year_count)}
        </p>
      </div>
      <div className="mt-5 h-[360px] min-w-0 overflow-hidden rounded-[1.2rem] border border-[var(--border-soft)]">
        <PlotlyChart
          data={[
            {
              type: "bar",
              x: years,
              y: counts,
              marker: { color: "#3675b7" },
              customdata: counts.map((count) => count / total),
              hovertemplate:
                "Publication year: %{x}<br>Documents: %{y}<br>Share: %{customdata:.0%}<extra></extra>",
            },
          ]}
          layout={{
            ...chartLayoutBase(isDark),
            autosize: true,
            height: 360,
            showlegend: false,
            yaxis: {
              ...(chartLayoutBase(isDark).yaxis as Record<string, unknown>),
              title: { text: "Number of documents" },
              rangemode: "tozero",
            },
            xaxis: {
              ...(chartLayoutBase(isDark).xaxis as Record<string, unknown>),
              title: { text: "Publication year" },
            },
          }}
          config={{ responsive: true, displaylogo: false }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </div>
    </section>
  );
}

function ReadinessStatusChart({
  summary,
}: {
  summary: StrategyInventorySummary;
}) {
  const { isDark } = useTheme();
  const breakdown = [...summary.status_breakdown].reverse();

  return (
    <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        AI readiness
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
        Readiness status breakdown
      </h2>
      <div className="mt-5 h-[360px] min-w-0 overflow-hidden rounded-[1.2rem] border border-[var(--border-soft)]">
        <PlotlyChart
          data={[
            {
              type: "bar",
              orientation: "h",
              x: breakdown.map((entry) => entry.count),
              y: breakdown.map((entry) => entry.category),
              marker: {
                color: breakdown.map((entry) => readinessColors[entry.category]),
              },
              hovertemplate: "%{y}<br>LSGs / records: %{x}<extra></extra>",
            },
          ]}
          layout={{
            ...chartLayoutBase(isDark),
            autosize: true,
            height: 360,
            showlegend: false,
            margin: { l: 150, r: 24, t: 30, b: 48 },
            xaxis: {
              ...(chartLayoutBase(isDark).xaxis as Record<string, unknown>),
              title: { text: "Count" },
              rangemode: "tozero",
            },
          }}
          config={{ responsive: true, displaylogo: false }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </div>
    </section>
  );
}

function StrategyInventoryTable({
  records,
}: {
  records: StrategyInventoryRecord[];
}) {
  const [filters, setFilters] = useState<StrategyInventoryFilters>({
    documentType: "all",
    publicationYear: "all",
    readinessCategory: "all",
    translationStatus: "all",
  });
  const [sort, setSort] = useState<SortState>({
    key: "lsg_name",
    direction: "asc",
  });
  const yearOptions = useMemo(() => buildYearOptions(records), [records]);
  const filteredRows = useMemo(
    () => filterStrategyInventoryRecords(records, filters),
    [filters, records],
  );
  const sortedRows = useMemo(
    () => [...filteredRows].sort((left, right) => compareRecords(left, right, sort)),
    [filteredRows, sort],
  );

  function updateFilter<Key extends keyof StrategyInventoryFilters>(
    key: Key,
    value: StrategyInventoryFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border-soft)] p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Document inventory
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Local strategy and budget documents
            </h2>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {formatNumber(sortedRows.length)} of {formatNumber(records.length)} inventory records
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-2">
            <FieldLabel>Search LSG</FieldLabel>
            <input
              type="search"
              value={filters.query ?? ""}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Search by LSG name"
              className="h-11 rounded-full border border-[var(--border-soft)] bg-white px-4 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)] dark:bg-[var(--surface-strong)]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Publication year</FieldLabel>
            <select
              value={filters.publicationYear ?? "all"}
              onChange={(event) => updateFilter("publicationYear", event.target.value)}
              className={selectClassName()}
            >
              <option value="all">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Readiness</FieldLabel>
            <select
              value={filters.readinessCategory ?? "all"}
              onChange={(event) =>
                updateFilter(
                  "readinessCategory",
                  event.target.value as StrategyInventoryFilters["readinessCategory"],
                )
              }
              className={selectClassName()}
            >
              <option value="all">All statuses</option>
              {READINESS_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Document type</FieldLabel>
            <select
              value={filters.documentType ?? "all"}
              onChange={(event) =>
                updateFilter(
                  "documentType",
                  event.target.value as StrategyInventoryFilters["documentType"],
                )
              }
              className={selectClassName()}
            >
              <option value="all">All types</option>
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <FieldLabel>Translation</FieldLabel>
            <select
              value={filters.translationStatus ?? "all"}
              onChange={(event) =>
                updateFilter(
                  "translationStatus",
                  event.target.value as StrategyInventoryFilters["translationStatus"],
                )
              }
              className={selectClassName()}
            >
              <option value="all">All translation states</option>
              {Object.entries(translationStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[1180px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[210px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[135px]" />
            <col className="w-[150px]" />
            <col className="w-[165px]" />
            <col className="w-[140px]" />
            <col className="w-[120px]" />
            <col className="w-[140px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[var(--surface)] shadow-[0_1px_0_var(--border-soft)]">
            <tr className="border-b border-[var(--border-soft)]">
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => updateSort("lsg_name")}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]"
                >
                  LSG Name {sort.key === "lsg_name" ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                Region
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                Document Type
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => updateSort("publication_year")}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]"
                >
                  Publication Year{" "}
                  {sort.key === "publication_year" ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                Source Status
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                Translation Status
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                Parsing Status
              </th>
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">
                AI-ready
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => updateSort("readiness_category")}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--muted-foreground)]"
                >
                  Source Link{" "}
                  {sort.key === "readiness_category" ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {sortedRows.length > 0 ? (
              sortedRows.map((record) => {
                const readinessCategory = getReadinessCategory(record);

                return (
                  <tr key={`${record.lsg_id}-${record.document_type}`} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--foreground)]">{record.lsg_name}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {record.lsg_name_local || "Unknown local name"}
                      </p>
                      <div className="mt-2">
                        <ReadinessBadge category={readinessCategory} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {record.region_name || "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {documentTypeLabels[record.document_type]}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {formatPublicationYear(record.publication_year)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {sourceStatusLabels[record.source_status]}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {translationStatusLabels[record.translation_status]}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {parsingStatusLabels[record.parsing_status]}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                      {readinessCategory === "AI-ready" ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-4">
                      {record.source_url ? (
                        <a
                          href={record.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] dark:bg-[var(--surface-strong)]"
                        >
                          Open source
                        </a>
                      ) : (
                        <span className="text-sm text-[var(--muted-foreground)]">
                          No link available
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]"
                >
                  No local strategy inventory records match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FollowUpPanel({
  records,
  summary,
  countryName,
}: {
  records: StrategyInventoryRecord[];
  summary: StrategyInventorySummary;
  countryName: string;
}) {
  const followUpRecords = useMemo(
    () =>
      records
        .filter((record) => getReadinessCategory(record) !== "AI-ready")
        .sort((left, right) => left.lsg_name.localeCompare(right.lsg_name)),
    [records],
  );
  const visibleRecords = followUpRecords.slice(0, 10);

  return (
    <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Follow-up queue
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            LSGs Requiring Follow-up
          </h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Missing or incomplete records indicate where additional source collection,
          translation, or validation may be required before AI-assisted analysis.
        </p>
      </div>

      {summary.unlisted_missing_lsg_count > 0 ? (
        <div className="mt-5 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 text-sm leading-7 text-[var(--muted-foreground)]">
          {formatNumber(summary.unlisted_missing_lsg_count)} expected {countryName} LSGs are not
          represented in the current inventory yet. Add the validated master list
          to convert this count into named follow-up rows.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {visibleRecords.map((record) => {
          const readinessCategory = getReadinessCategory(record);

          return (
            <article
              key={`follow-up-${record.lsg_id}-${record.document_type}`}
              className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{record.lsg_name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {record.region_name || "Unknown region"} ·{" "}
                    {documentTypeLabels[record.document_type]}
                  </p>
                </div>
                <ReadinessBadge category={readinessCategory} />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                {record.notes || "Additional source review is required."}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function StrategyInventoryDashboard({
  dataset,
}: {
  dataset: StrategyInventoryDataset;
}) {
  const summary = useMemo(
    () => getStrategyInventorySummary(
      dataset.records,
      dataset.expected_lsg_count,
    ),
    [dataset.expected_lsg_count, dataset.records],
  );
  const countReadinessCategory = (category: ReadinessCategory) =>
    summary.status_breakdown.find((entry) => entry.category === category)?.count ?? 0;
  const needsTranslationOrValidation =
    countReadinessCategory("Needs Translation") + countReadinessCategory("Needs Validation");

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-[var(--border-soft)] bg-[radial-gradient(circle_at_top,var(--hero-glow),transparent_38%),linear-gradient(180deg,var(--hero-wash-start),var(--hero-wash-end))]">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {dataset.country_name} workspace
          </p>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Local Strategy Inventory Dashboard
          </h1>
          <p className="mt-6 max-w-4xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
            Coverage, publication year, translation status, and AI-readiness of
            local strategy and budget documents across {dataset.country_name} LSGs.
          </p>
          <p className="mt-5 max-w-5xl text-sm leading-7 text-[var(--muted-foreground)]">
            The Strategy Inventory Dashboard summarizes the availability and readiness
            of local strategy and budget documents across {dataset.country_name} LSGs. It helps users
            assess whether the planning evidence base is sufficiently complete, current,
            translated, and AI-ready to support alignment analysis, SWOT synthesis, and
            investment recommendations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2">
              {dataset.country_name} LSG universe: {formatNumber(summary.expected_lsgs)}
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2">
              Last updated: {formatDate(summary.latest_last_updated ?? dataset.last_updated)}
            </span>
            {dataset.is_sample_data ? (
              <span className="rounded-full border border-[#c7923e]/50 bg-[#c7923e]/15 px-4 py-2 font-medium text-[#9a6400] dark:text-[#f4c15d]">
                Sample inventory for preview
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto my-12 flex w-full max-w-7xl flex-col gap-8 px-6 sm:px-8 lg:px-12">
        {dataset.is_sample_data ? (
          <aside className="rounded-[1.5rem] border border-[#c7923e]/45 bg-[#c7923e]/12 p-5 text-sm leading-7 text-[var(--foreground)]">
            This dashboard is currently wired to a clearly marked sample dataset with{" "}
            {formatNumber(dataset.records.length)} records. It is ready for the full
            {dataset.country_name} LSG inventory once validated source metadata is added.
          </aside>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label="LSGs Expected"
            value={formatNumber(summary.expected_lsgs)}
            helper={`Expected ${dataset.country_name} LSG universe.`}
          />
          <KpiCard
            label="LSGs with Documents"
            value={`${formatNumber(summary.lsgs_with_any_document)} / ${formatNumber(summary.expected_lsgs)}`}
            helper="Distinct LSGs with at least one document source."
          />
          <KpiCard
            label="Coverage Rate"
            value={formatPercent(summary.coverage_rate)}
            helper="LSG-level coverage, not document count."
          />
          <KpiCard
            label="Documents Found"
            value={formatNumber(summary.total_documents_found)}
            helper="Strategy, budget, plan, and other records."
          />
          <KpiCard
            label="AI-ready"
            value={formatNumber(summary.ai_ready_documents)}
            helper="Parsed records ready for AI-assisted analysis."
          />
          <KpiCard
            label="Needs Translation / Validation"
            value={formatNumber(needsTranslationOrValidation)}
            helper="Records blocked before full AI use."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <PublicationYearChart summary={summary} />
          <ReadinessStatusChart summary={summary} />
        </div>

        <StrategyInventoryTable records={dataset.records} />

        <FollowUpPanel
          countryName={dataset.country_name}
          records={dataset.records}
          summary={summary}
        />

        <aside className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 text-sm leading-7 text-[var(--muted-foreground)]">
          Coverage is calculated at the LSG level. Document counts may exceed the
          number of LSGs where multiple plans, strategies, or budgets are available
          for the same local government.
        </aside>
      </section>
    </main>
  );
}
