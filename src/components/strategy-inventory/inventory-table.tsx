"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import { ARTICLE_LINK } from "@/components/layout/article";
import { StatusMarker } from "@/components/strategy-inventory/status-marker";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, filterInventoryRows, type InventoryRow } from "@/lib/strategy-inventory/public";
import { READINESS_CATEGORIES } from "@/lib/strategy-inventory/summarize";
import type { ReadinessCategory } from "@/lib/strategy-inventory/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

const HEAD_CELL = "border-b border-[var(--border-strong)] px-3 pb-2 text-left align-bottom text-sm font-medium text-ink-muted first:pl-0 last:pr-0";
const BODY_CELL = "border-b border-[var(--border-soft)] px-3 py-3 align-top first:pl-0 last:pr-0";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type SortKey = "name" | "period" | "status";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const STATUS_ORDER = new Map(READINESS_CATEGORIES.map((category, index) => [category, index]));

function compareRows(left: InventoryRow, right: InventoryRow, sort: SortState) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const byName = left.name.localeCompare(right.name);
  if (sort.key === "period") {
    // Plans with no year stay at the bottom in either direction.
    if (left.sortYear === null || right.sortYear === null) return Number(left.sortYear === null) - Number(right.sortYear === null) || byName;
    return (left.sortYear - right.sortYear) * direction || byName;
  }
  if (sort.key === "status") return (STATUS_ORDER.get(left.status)! - STATUS_ORDER.get(right.status)!) * direction || byName;
  return byName * direction;
}

function SortableHeader({ label, column, sort, onSort, className }: { label: ReactNode; column: SortKey; sort: SortState; onSort: (column: SortKey) => void; className?: string }) {
  const active = sort.key === column;
  return (
    <th scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={cn(HEAD_CELL, className)}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md hover:text-ink md:min-h-0 ${FOCUS_RING}`}>
        {label}
        <span aria-hidden="true" className="inline-flex w-2.5 justify-center text-xs">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : null}
        </span>
      </button>
    </th>
  );
}

function DocumentLink({ row, lang }: { row: InventoryRow; lang?: string }) {
  if (!row.url) return <span className="text-ink-muted">No link</span>;
  return (
    <>
      <a href={row.url} target="_blank" rel="noreferrer" lang={row.title ? lang : undefined} className={cn(ARTICLE_LINK, "line-clamp-2 break-words")}>
        {row.title ?? "Open document"}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {row.host ? <span className="mt-0.5 block truncate text-xs text-ink-muted">{row.host}</span> : null}
    </>
  );
}

/**
 * Every unit's document, with a search box and one toggle per status. The rows arrive built on the
 * server, without the records' notes.
 */
export function InventoryTable({
  rows,
  unitSingular,
  unitPlural,
  regionLabel,
  localLang,
}: {
  rows: readonly InventoryRow[];
  unitSingular: string;
  unitPlural: string;
  regionLabel: string;
  /** The language of local names and document titles, such as "sr". */
  localLang?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReadinessCategory | "all">("all");
  const [sort, setSort] = useState<SortState>({ key: "name", direction: "asc" });
  const [showAll, setShowAll] = useState(false);

  const counts = useMemo(() => READINESS_CATEGORIES.map((category) => ({ category, count: rows.filter((row) => row.status === category).length })), [rows]);
  const sorted = useMemo(() => [...filterInventoryRows(rows, query, status)].sort((left, right) => compareRows(left, right, sort)), [rows, query, status, sort]);
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);

  function handleSort(column: SortKey) {
    setSort((current) => ({ key: column, direction: current.key === column && current.direction === "asc" ? "desc" : "asc" }));
  }

  const toggles: ReadonlyArray<{ value: ReadinessCategory | "all"; label: string; count: number }> = [
    { value: "all", label: "All", count: rows.length },
    ...counts.filter((entry) => entry.count > 0).map((entry) => ({ value: entry.category, label: STATUS_LABELS[entry.category], count: entry.count })),
  ];

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-xs lg:w-72">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            Find a {unitSingular} or document
          </label>
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`min-h-11 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-ink placeholder:text-ink-muted md:min-h-0 md:py-1.5 ${FOCUS_RING}`}
          />
        </div>
        <div role="group" aria-label="Show status" className="flex flex-wrap gap-1.5">
          {toggles.map((toggle) => (
            <button
              key={toggle.value}
              type="button"
              aria-pressed={status === toggle.value}
              onClick={() => setStatus(toggle.value)}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--border-strong)] px-3 text-sm text-ink transition-colors duration-150 hover:bg-[var(--surface-muted)] md:min-h-8",
                "aria-pressed:border-[var(--ink)] aria-pressed:bg-[var(--surface-muted)] aria-pressed:font-medium",
                FOCUS_RING,
              )}
            >
              {toggle.value === "all" ? null : <StatusMarker status={toggle.value} />}
              {toggle.label}
              <span className="tabular-nums text-ink-muted">{toggle.count}</span>
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-ink-muted">
        {sorted.length === rows.length ? `${rows.length} ${unitPlural}` : `${sorted.length} of ${rows.length} ${unitPlural}`}
      </p>

      <table className="mt-2 w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">
          The plan document for each {unitSingular}: the years it covers, where it stands, and a link to it.
        </caption>
        <thead>
          <tr>
            <SortableHeader label={unitSingular.charAt(0).toUpperCase() + unitSingular.slice(1)} column="name" sort={sort} onSort={handleSort} className="w-[46%] sm:w-[27%]" />
            <SortableHeader label="Years" column="period" sort={sort} onSort={handleSort} className="hidden w-[15%] sm:table-cell" />
            <SortableHeader label="Status" column="status" sort={sort} onSort={handleSort} className="sm:w-[27%]" />
            <th scope="col" className={cn(HEAD_CELL, "hidden w-[31%] sm:table-cell")}>
              Document
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.key}>
              <td className={cn(BODY_CELL, "break-words")}>
                <span className="font-medium text-ink">{row.name}</span>
                {row.localName || row.region ? (
                  <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                    {row.localName ? <span lang={localLang}>{row.localName}</span> : null}
                    {row.localName && row.region ? " · " : null}
                    {row.region ? (
                      <>
                        <span className="sr-only">{regionLabel}: </span>
                        {row.region}
                      </>
                    ) : null}
                  </span>
                ) : null}
                {/* On phones the years and the link fold under the name. */}
                <span className="mt-1.5 block space-y-1 sm:hidden">
                  {row.period ? <span className="block text-xs tabular-nums text-ink">{row.period}</span> : null}
                  {row.url ? <DocumentLink row={row} lang={localLang} /> : null}
                </span>
              </td>
              <td className={cn(BODY_CELL, "hidden tabular-nums text-ink sm:table-cell")}>{row.period}</td>
              <td className={BODY_CELL}>
                <span className="flex items-center gap-2 font-medium text-ink">
                  <StatusMarker status={row.status} />
                  {STATUS_LABELS[row.status]}
                </span>
                {row.issue ? <span className="mt-1 block text-xs leading-5 text-ink-muted">{row.issue}</span> : null}
              </td>
              <td className={cn(BODY_CELL, "hidden min-w-0 sm:table-cell")}>
                <DocumentLink row={row} lang={localLang} />
              </td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-ink-muted">
                No {unitPlural} match.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {sorted.length > PAGE_SIZE ? (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show fewer" : `Show all ${sorted.length}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
