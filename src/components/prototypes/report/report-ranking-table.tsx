"use client";

import { useId, useMemo, useState } from "react";

import type { AdminLabels } from "@/lib/countries";

import { formatScore, type RankedFeature } from "../shared/derive";

export type ReportRankingTableProps = {
  /** From rankFeatures(data.map.features). */
  rows: RankedFeature[];
  selectedCompositeKey: string;
  metricLabel: string;
  adminLabels: AdminLabels;
  onSelect: (compositeKey: string) => void;
};

type SortKey = "rank" | "name" | "district" | "province" | "value";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const PAGE_SIZE = 25;

const HEAD_CELL =
  "border-b border-[var(--proto-rule-strong)] px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--proto-muted)] first:pl-0 last:pr-0";
const BODY_CELL = "border-t border-[var(--proto-rule)] px-3 py-3 align-middle first:pl-0 last:pr-0";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";
const TEXT_BUTTON = `min-h-11 cursor-pointer text-sm font-medium text-[var(--proto-link)] underline-offset-4 hover:underline disabled:cursor-default disabled:text-[var(--proto-muted)] disabled:no-underline md:min-h-0 rounded-[var(--proto-radius-control)] ${FOCUS_RING}`;

const SORT_VALUE: Record<SortKey, (row: RankedFeature) => string | number | null> = {
  rank: (row) => row.rank,
  name: (row) => row.name,
  district: (row) => row.district,
  province: (row) => row.province,
  value: (row) => row.value,
};

/** Nulls sort last in both directions. Ties fall back to name. */
function compareRows(a: RankedFeature, b: RankedFeature, sort: SortState) {
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

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "metric";
}

function escapeCsvCell(cell: string | number | null) {
  if (cell === null) return "";
  const text = String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(lines: Array<Array<string | number | null>>, filename: string) {
  // A byte order mark keeps non-ASCII names readable when the file opens in Excel.
  const csv = `﻿${lines.map((cells) => cells.map(escapeCsvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SortArrow({ direction }: { direction: "asc" | "desc" }) {
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
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  right?: boolean;
  className?: string;
};

function SortableHeader({ label, column, sort, onSort, right = false, className = "" }: SortableHeaderProps) {
  const active = sort.key === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      className={`${HEAD_CELL} ${right ? "text-right" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--proto-radius-control)] hover:text-[var(--proto-ink)] md:min-h-0 ${FOCUS_RING}`}
      >
        {label}
        <span aria-hidden="true" className="inline-flex w-2.5 justify-center">
          {active ? <SortArrow direction={sort.direction} /> : null}
        </span>
      </button>
    </th>
  );
}

type RankingRowProps = {
  row: RankedFeature;
  selected: boolean;
  showDistrict: boolean;
  onSelect: (compositeKey: string) => void;
};

function RankingRow({ row, selected, showDistrict, onSelect }: RankingRowProps) {
  return (
    <tr className={`hover:bg-[var(--proto-surface-sunken)] ${selected ? "font-medium" : ""}`}>
      <td className={`${BODY_CELL} relative text-right tabular-nums`}>
        {selected ? (
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-[var(--proto-accent)]" />
        ) : null}
        {row.rank}
      </td>
      <td className={BODY_CELL}>
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={() => onSelect(row.compositeKey)}
          className={`min-h-11 cursor-pointer text-left text-[var(--proto-ink)] underline-offset-4 hover:underline md:min-h-0 rounded-[var(--proto-radius-control)] ${FOCUS_RING}`}
        >
          {row.name}
        </button>
      </td>
      {showDistrict ? <td className={`${BODY_CELL} hidden sm:table-cell`}>{row.district}</td> : null}
      <td className={`${BODY_CELL} hidden sm:table-cell`}>{row.province}</td>
      <td className={`${BODY_CELL} text-right tabular-nums`}>
        {row.value === null ? <span className="text-[var(--proto-muted)]">No data</span> : formatScore(row.value, 1)}
      </td>
    </tr>
  );
}

export function ReportRankingTable({
  rows,
  selectedCompositeKey,
  metricLabel,
  adminLabels,
  onSelect,
}: ReportRankingTableProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "rank", direction: "asc" });
  const [showAll, setShowAll] = useState(false);

  const middle = adminLabels.middle;
  const plural = adminLabels.lower.plural.toLowerCase();
  const nameLabel = capitalize(adminLabels.lower.singular);
  const higherLabel = capitalize(adminLabels.higher.singular);
  const columns = middle ? 5 : 4;
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
  // A selection hidden by the filter stays hidden: the pin follows the filter, not the other way round.
  const selected = sorted.find((row) => row.compositeKey === selectedCompositeKey);
  const pinned = selected && !visible.includes(selected) ? selected : undefined;

  function handleSort(column: SortKey) {
    setSort((current) => {
      if (current.key !== column) {
        return { key: column, direction: column === "value" ? "desc" : "asc" };
      }
      return { key: column, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function handleDownload() {
    const header = [
      "Rank",
      nameLabel,
      ...(middle ? [capitalize(middle.singular)] : []),
      higherLabel,
      metricLabel,
    ];
    const body = sorted.map((row) => [
      row.rank,
      row.name,
      ...(middle ? [row.district] : []),
      row.province,
      row.value,
    ]);
    downloadCsv([header, ...body], `ldt-ranking-${slugify(metricLabel)}.csv`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--proto-ink)]">
            Filter by name
          </label>
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`min-h-11 rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface)] px-3 text-sm text-[var(--proto-ink)] placeholder:text-[var(--proto-muted)] md:min-h-0 md:py-1.5 ${FOCUS_RING}`}
          />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={sorted.length === 0}
          className={TEXT_BUTTON}
        >
          Download CSV
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{`Ranking of ${plural} by ${metricLabel}`}</caption>
        <thead>
          <tr>
            <SortableHeader label="Rank" column="rank" sort={sort} onSort={handleSort} right />
            <SortableHeader label={nameLabel} column="name" sort={sort} onSort={handleSort} />
            {middle ? (
              <SortableHeader
                label={capitalize(middle.singular)}
                column="district"
                sort={sort}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
            ) : null}
            <SortableHeader
              label={higherLabel}
              column="province"
              sort={sort}
              onSort={handleSort}
              className="hidden sm:table-cell"
            />
            <SortableHeader label={metricLabel} column="value" sort={sort} onSort={handleSort} right />
          </tr>
        </thead>

        {pinned ? (
          <tbody>
            <tr>
              <td
                colSpan={columns}
                className="pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--proto-muted)] first:pl-0"
              >
                Selected
              </td>
            </tr>
            <RankingRow
              row={pinned}
              selected
              showDistrict={Boolean(middle)}
              onSelect={onSelect}
            />
          </tbody>
        ) : null}

        <tbody>
          {visible.map((row) => (
            <RankingRow
              key={row.compositeKey}
              row={row}
              selected={row.compositeKey === selectedCompositeKey}
              showDistrict={Boolean(middle)}
              onSelect={onSelect}
            />
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns} className={`${BODY_CELL} text-[var(--proto-muted)]`}>
                {rows.length === 0 ? "No values for this measure." : `No ${plural} match this filter.`}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {sorted.length > PAGE_SIZE ? (
        <div className="mt-3">
          <button type="button" onClick={() => setShowAll((current) => !current)} className={TEXT_BUTTON}>
            {showAll ? "Show fewer" : `Show all ${sorted.length}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
