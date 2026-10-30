"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatScore } from "@/lib/analytics/derive";
import type { AdminLabels } from "@/lib/countries";
import { buildCsv, downloadCsv } from "@/lib/csv";
import type { AnalyticsPageData, MetricDefinition, RankingRow } from "@/types/analytics";

export type RankingTableProps = {
  ranking: AnalyticsPageData["ranking"];
  metric: MetricDefinition;
  adminLabels: AdminLabels;
  countrySlug: string;
  year: number;
  /** Units left out of the ranking because they have no boundary on the map. */
  unitsWithoutBoundary: AnalyticsPageData["coverage"]["unitsWithoutBoundary"];
  onSelect: (municipalityId: string) => void;
};

type SortKey = "rank" | "name" | "district" | "province" | "value";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const PAGE_SIZE = 25;

const HEAD_CELL = "border-b border-[var(--border-strong)] px-3 pb-2 align-bottom text-sm font-medium text-ink-muted first:pl-0 last:pr-0";
const BODY_CELL = "border-b border-[var(--border-soft)] px-3 py-2.5 align-top first:pl-0 last:pr-0";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const NAME_BUTTON = `min-h-11 cursor-pointer rounded-md text-left text-ink underline-offset-4 hover:underline md:min-h-0 ${FOCUS_RING}`;

const SORT_VALUE: Record<SortKey, (row: RankingRow) => string | number | null> = {
  rank: (row) => row.rank,
  name: (row) => row.name,
  district: (row) => row.district,
  province: (row) => row.province,
  value: (row) => row.value,
};

/** Rows without a value sort last in both directions. Ties fall back to name. */
function compareRows(a: RankingRow, b: RankingRow, sort: SortState) {
  const left = SORT_VALUE[sort.key](a);
  const right = SORT_VALUE[sort.key](b);
  if (left === null || right === null) {
    if (left === right) return a.name.localeCompare(b.name);
    return left === null ? 1 : -1;
  }
  const order =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  if (order === 0) return a.name.localeCompare(b.name);
  return sort.direction === "asc" ? order : -order;
}

function SortArrow({ direction }: { direction: SortState["direction"] }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className="h-2.5 w-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "asc" ? "M5 8.5v-7M2 4.5l3-3 3 3" : "M5 1.5v7M2 5.5l3 3 3-3"} />
    </svg>
  );
}

type SortableHeaderProps = {
  label: ReactNode;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  right?: boolean;
};

function SortableHeader({ label, column, sort, onSort, right = false }: SortableHeaderProps) {
  const active = sort.key === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`${HEAD_CELL} ${right ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md hover:text-ink md:min-h-0 ${FOCUS_RING}`}
      >
        {label}
        <span aria-hidden="true" className="inline-flex w-2.5 justify-center">
          {active ? <SortArrow direction={sort.direction} /> : null}
        </span>
      </button>
    </th>
  );
}

type RankingTableRowProps = {
  row: RankingRow;
  showMiddle: boolean;
  onSelect: (municipalityId: string) => void;
};

function RankingTableRow({ row, showMiddle, onSelect }: RankingTableRowProps) {
  return (
    <tr className={row.selected ? "bg-[var(--accent-soft)] font-medium" : "hover:bg-[var(--surface-muted)]"}>
      <td className={`${BODY_CELL} relative text-right tabular-nums`}>
        {row.selected ? (
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        ) : null}
        {row.rank}
      </td>
      <td className={`${BODY_CELL} break-words`}>
        <button
          type="button"
          aria-current={row.selected ? "true" : undefined}
          onClick={() => onSelect(row.id)}
          className={NAME_BUTTON}
        >
          {row.name}
        </button>
        {row.mapped ? null : <span className="block text-xs font-normal text-ink-muted">Not on map</span>}
      </td>
      {showMiddle ? <td className={`${BODY_CELL} break-words`}>{row.district}</td> : null}
      <td className={`${BODY_CELL} break-words`}>{row.province}</td>
      <td className={`${BODY_CELL} text-right tabular-nums`}>
        {row.value === null ? <span className="text-ink-muted">No data</span> : formatScore(row.value)}
      </td>
    </tr>
  );
}

export function RankingTable({
  ranking,
  metric,
  adminLabels,
  countrySlug,
  year,
  unitsWithoutBoundary,
  onSelect,
}: RankingTableProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "rank", direction: "asc" });
  const [showAll, setShowAll] = useState(false);

  const { rows, rankedCount } = ranking;
  // The middle column follows the country's middle level. Serbia and Zambia have none, and their district
  // repeats the province, so their table and CSV have no district column. Nepal keeps it, because 19 of its
  // municipality names repeat across districts.
  const middle = adminLabels.middle;
  const lowerSingular = adminLabels.lower.singular;
  const plural = adminLabels.lower.plural.toLowerCase();
  const columnCount = middle ? 5 : 4;
  const needle = query.trim().toLowerCase();

  const sorted = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            needle === "" ||
            [row.name, row.district, row.province].some((text) => text.toLowerCase().includes(needle)),
        )
        .sort((a, b) => compareRows(a, b, sort)),
    [rows, needle, sort],
  );

  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  // A selected row that the name filter hides stays hidden, so the filter wins over the pin.
  const selectedRow = sorted.find((row) => row.selected);
  const pinned = selectedRow && !visible.includes(selectedRow) ? selectedRow : undefined;

  const valueLabel = (
    <span className="flex flex-col text-right">
      {metric.name}
      {metric.unit ? <span className="text-xs font-normal text-ink-muted">{metric.unit}</span> : null}
    </span>
  );

  function handleSort(column: SortKey) {
    setSort((current) => {
      if (current.key !== column) {
        return { key: column, direction: column === "value" ? "desc" : "asc" };
      }
      return { key: column, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  // The CSV holds the whole ranking in rank order, whatever the name filter or sort shows.
  function handleDownload() {
    const csv = buildCsv(
      [
        "Rank",
        lowerSingular,
        ...(middle ? [middle.singular] : []),
        adminLabels.higher.singular,
        metric.label,
        "Mapped",
      ],
      rows.map((row) => [
        row.rank,
        row.name,
        ...(middle ? [row.district] : []),
        row.province,
        row.value,
        row.mapped,
      ]),
    );
    downloadCsv(`${countrySlug}-${metric.id}-${year}.csv`, csv);
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {`Filter by ${lowerSingular.toLowerCase()} name`}
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
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={rows.length === 0}>
          Download CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
          <caption className="pb-3 text-left">
            <span className="block max-w-[20rem] text-sm font-medium text-ink sm:max-w-md">
              {metric.name}
              {metric.unit ? ` (${metric.unit})` : ""}, {year}, ranked highest first.
            </span>
            <span className="block max-w-[20rem] text-sm font-normal text-ink-muted sm:max-w-md">
              {rankedCount} of {rows.length} have a value.
            </span>
          </caption>
          <thead>
            <tr>
              <SortableHeader label="Rank" column="rank" sort={sort} onSort={handleSort} right />
              <SortableHeader label={lowerSingular} column="name" sort={sort} onSort={handleSort} />
              {middle ? (
                <SortableHeader label={middle.singular} column="district" sort={sort} onSort={handleSort} />
              ) : null}
              <SortableHeader label={adminLabels.higher.singular} column="province" sort={sort} onSort={handleSort} />
              <SortableHeader label={valueLabel} column="value" sort={sort} onSort={handleSort} right />
            </tr>
          </thead>

          {pinned ? (
            <tbody>
              <tr>
                <td colSpan={columnCount} className="pb-1 pt-4 text-sm font-medium text-ink-muted">
                  Selected
                </td>
              </tr>
              <RankingTableRow row={pinned} showMiddle={Boolean(middle)} onSelect={onSelect} />
            </tbody>
          ) : null}

          <tbody>
            {visible.map((row) => (
              <RankingTableRow key={row.id} row={row} showMiddle={Boolean(middle)} onSelect={onSelect} />
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="py-3 text-ink-muted">
                  {rows.length === 0 ? "No values for this measure." : `No ${plural} match this filter.`}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show fewer" : `Show all ${sorted.length}`}
          </Button>
        </div>
      ) : null}

      {unitsWithoutBoundary.length > 0 ? (
        <details className="mt-4 max-w-[70ch] text-sm text-ink-muted">
          <summary className={`cursor-pointer text-ink ${FOCUS_RING}`}>
            {unitsWithoutBoundary.length} {plural} are not ranked because they have no boundary on the map.
          </summary>
          <p className="mt-2">
            They have scores in the source data but no matching boundary, so they are left out of every rank, count, and
            average until the source data is checked.
          </p>
          <ul className="mt-2 columns-1 gap-6 sm:columns-2 lg:columns-3">
            {unitsWithoutBoundary.map((unit) => (
              <li key={unit.id}>
                {unit.name}, {middle ? unit.district : unit.province}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
