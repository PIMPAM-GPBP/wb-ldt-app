"use client";

import { useMemo, useState } from "react";

import { PlotlyChart } from "@/components/analytics/plotly-chart";
import { useTheme } from "@/components/theme/theme-provider";

export type SngDisplayRow = {
  rowKey: string;
  municipality: string;
  province: string;
  population: number | null;
  totalLandAreaKm2: number | null;
  infrastructureScore: number | null;
  livabilityScore: number | null;
  prosperityScore: number | null;
  pilAggregate: number | null;
  hasDevelopmentStrategy: boolean;
  strategyLevel: string | null;
  link: string | null;
};

type SortKey = keyof SngDisplayRow;

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

type TableColumn = {
  key: SortKey;
  label: string;
  align?: "left" | "right" | "center";
  render: (row: SngDisplayRow) => string | number | null;
};

type SngDisplayLabels = {
  lowerSingular: string;
  lowerPlural: string;
  higherSingular: string;
  higherPlural: string;
  csvFileName: string;
};

type ExportColumn = {
  label: string;
  render: (row: SngDisplayRow) => string | number | boolean | null;
};

const defaultLabels: SngDisplayLabels = {
  lowerSingular: "Municipality",
  lowerPlural: "Municipalities",
  higherSingular: "Province",
  higherPlural: "Provinces",
  csvFileName: "nepal-sng-municipality-metrics.csv",
};

function buildTableColumns(labels: SngDisplayLabels): TableColumn[] {
  return [
    { key: "municipality", label: labels.lowerSingular, render: (row) => row.municipality },
    { key: "province", label: labels.higherSingular, render: (row) => row.province },
    { key: "population", label: "Population", align: "right", render: (row) => row.population },
    {
      key: "totalLandAreaKm2",
      label: "Area (km2)",
      align: "right",
      render: (row) => row.totalLandAreaKm2,
    },
    {
      key: "infrastructureScore",
      label: "Infrastructure",
      align: "right",
      render: (row) => row.infrastructureScore,
    },
    {
      key: "livabilityScore",
      label: "Livability",
      align: "right",
      render: (row) => row.livabilityScore,
    },
    {
      key: "prosperityScore",
      label: "Prosperity",
      align: "right",
      render: (row) => row.prosperityScore,
    },
    {
      key: "pilAggregate",
      label: "PIL aggregate",
      align: "right",
      render: (row) => row.pilAggregate,
    },
    {
      key: "hasDevelopmentStrategy",
      label: "Strategy",
      align: "center",
      render: (row) => (row.hasDevelopmentStrategy ? "Yes" : "No"),
    },
    {
      key: "strategyLevel",
      label: "Strategy level",
      render: (row) => row.strategyLevel,
    },
  ];
}

function buildExportColumns(labels: SngDisplayLabels): ExportColumn[] {
  return [
    { label: labels.lowerSingular, render: (row) => row.municipality },
    { label: labels.higherSingular, render: (row) => row.province },
    { label: "Population", render: (row) => row.population },
    { label: "Area (km2)", render: (row) => row.totalLandAreaKm2 },
    { label: "Infrastructure Score", render: (row) => row.infrastructureScore },
    { label: "Livability Score", render: (row) => row.livabilityScore },
    { label: "Prosperity Score", render: (row) => row.prosperityScore },
    { label: "PIL Aggregate", render: (row) => row.pilAggregate },
    { label: "Has Development Strategy", render: (row) => row.hasDevelopmentStrategy ? "Yes" : "No" },
    { label: "Strategy Level", render: (row) => row.strategyLevel },
    { label: "Link", render: (row) => row.link },
  ];
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatCellValue(value: string | number | null) {
  if (value === null || value === "") {
    return "n/a";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? numberFormatter.format(value) : decimalFormatter.format(value);
  }

  return value;
}

function escapeCsvValue(value: string | number | boolean | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv(rows: SngDisplayRow[], exportColumns: ExportColumn[]) {
  const header = exportColumns.map((column) => escapeCsvValue(column.label)).join(",");
  const body = rows.map((row) =>
    exportColumns.map((column) => escapeCsvValue(column.render(row))).join(","),
  );

  return [header, ...body].join("\r\n");
}

function compareValues(left: SngDisplayRow, right: SngDisplayRow, sort: SortState) {
  const leftValue = left[sort.key];
  const rightValue = right[sort.key];
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * directionMultiplier;
  }

  if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
    return (Number(leftValue) - Number(rightValue)) * directionMultiplier;
  }

  return String(leftValue).localeCompare(String(rightValue)) * directionMultiplier;
}

function buildCurveRows(rows: SngDisplayRow[]) {
  const sortedRows = rows
    .filter((row) => typeof row.population === "number" && row.population >= 0)
    .sort((left, right) => (left.population ?? 0) - (right.population ?? 0));
  const totalPopulation = sortedRows.reduce((sum, row) => sum + (row.population ?? 0), 0);
  let cumulativePopulation = 0;

  return sortedRows.map((row, index) => {
    cumulativePopulation += row.population ?? 0;

    return {
      ...row,
      rank: index + 1,
      cumulativeShare: totalPopulation > 0 ? cumulativePopulation / totalPopulation : 0,
    };
  });
}

function tertileMaxLabel(rows: ReturnType<typeof buildCurveRows>, index: number) {
  const row = rows[index - 1];
  return row?.population === null || row?.population === undefined
    ? "n/a"
    : numberFormatter.format(row.population);
}

export function SngDisplaySection({
  rows,
  labels = defaultLabels,
}: {
  rows: SngDisplayRow[];
  labels?: Partial<SngDisplayLabels>;
}) {
  const displayLabels = useMemo(
    () => ({ ...defaultLabels, ...labels }),
    [labels],
  );
  const { isDark } = useTheme();
  const [sort, setSort] = useState<SortState>({
    key: "population",
    direction: "desc",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const textColor = isDark ? "#f5f7ff" : "#374291";
  const gridColor = isDark ? "rgba(201,211,234,0.1)" : "rgba(55,66,145,0.08)";
  const chartSurface = isDark ? "rgba(7,28,42,0.96)" : "#ffffff";
  const tableColumns = useMemo(() => buildTableColumns(displayLabels), [displayLabels]);
  const exportColumns = useMemo(() => buildExportColumns(displayLabels), [displayLabels]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      exportColumns.some((column) => {
        const value = column.render(row);
        return value !== null && String(value).toLowerCase().includes(query);
      }),
    );
  }, [exportColumns, rows, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => compareValues(left, right, sort));
  }, [filteredRows, sort]);

  const curveRows = useMemo(() => buildCurveRows(rows), [rows]);
  const totalRows = curveRows.length;
  const firstTertile = Math.floor(totalRows / 3);
  const secondTertile = Math.floor((2 * totalRows) / 3);

  function updateSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function downloadTable() {
    const csv = buildCsv(rows, exportColumns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = displayLabels.csvFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              Population distribution by {displayLabels.lowerSingular.toLowerCase()}
            </h3>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
            {displayLabels.lowerPlural} are ranked from smallest to largest population and plotted
            against cumulative population share. Tertile guides separate the reference
            groups used for small, medium, and large {displayLabels.lowerSingular.toLowerCase()} analysis.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border-soft)]">
          <div className="h-[420px] min-w-[680px] sm:h-[460px]">
            <PlotlyChart
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  name: "Municipalities",
                  x: curveRows.map((row) => row.rank),
                  y: curveRows.map((row) => row.cumulativeShare),
                  text: curveRows.map((row) => row.municipality),
                  customdata: curveRows.map((row) => [
                    row.province,
                    row.population,
                    row.cumulativeShare,
                  ]),
                  marker: { color: "#6375ff", size: 6 },
                  line: { color: "#6375ff", width: 3 },
                  hovertemplate:
                    `${displayLabels.lowerSingular}: %{text}<br>${displayLabels.higherSingular}: %{customdata[0]}<br>Rank: %{x}<br>Population: %{customdata[1]:,}<br>Cumulative share: %{customdata[2]:.2f}<extra></extra>`,
                },
              ]}
              layout={{
                autosize: true,
                height: 460,
                margin: { l: 64, r: 24, t: 42, b: 64 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: chartSurface,
                hovermode: "closest",
                showlegend: false,
                shapes: [
                  {
                    type: "line",
                    x0: firstTertile,
                    x1: firstTertile,
                    y0: 0,
                    y1: 1,
                    xref: "x",
                    yref: "y",
                    line: { color: textColor, width: 2 },
                  },
                  {
                    type: "line",
                    x0: secondTertile,
                    x1: secondTertile,
                    y0: 0,
                    y1: 1,
                    xref: "x",
                    yref: "y",
                    line: { color: textColor, width: 2 },
                  },
                ],
                annotations: [
                  {
                    x: firstTertile / 2,
                    y: 0.54,
                    text: "Small",
                    showarrow: false,
                    font: { size: 24, color: "#e45756" },
                  },
                  {
                    x: firstTertile / 2,
                    y: 0.43,
                    text: tertileMaxLabel(curveRows, firstTertile),
                    showarrow: false,
                    font: { size: 13, color: textColor },
                  },
                  {
                    x: (firstTertile + secondTertile) / 2,
                    y: 0.54,
                    text: "Medium",
                    showarrow: false,
                    font: { size: 24, color: "#d9a500" },
                  },
                  {
                    x: (firstTertile + secondTertile) / 2,
                    y: 0.43,
                    text: tertileMaxLabel(curveRows, secondTertile),
                    showarrow: false,
                    font: { size: 13, color: textColor },
                  },
                  {
                    x: (secondTertile + totalRows) / 2,
                    y: 0.54,
                    text: "Large",
                    showarrow: false,
                    font: { size: 24, color: "#2b8a3e" },
                  },
                  {
                    x: (secondTertile + totalRows) / 2,
                    y: 0.43,
                    text: tertileMaxLabel(curveRows, totalRows),
                    showarrow: false,
                    font: { size: 13, color: textColor },
                  },
                ],
                xaxis: {
                  title: { text: "Population rank (smallest to largest)", font: { color: textColor } },
                  showgrid: true,
                  gridcolor: gridColor,
                  tickfont: { color: textColor },
                  range: [1, Math.max(totalRows, 1)],
                },
                yaxis: {
                  title: { text: "Cumulative share", font: { color: textColor } },
                  showgrid: true,
                  gridcolor: gridColor,
                  tickfont: { color: textColor },
                  range: [0, 1],
                  tickformat: ".0%",
                },
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              {displayLabels.lowerSingular} metrics
            </h3>
            <label className="relative w-full sm:w-[18rem]">
              <span className="sr-only">Search {displayLabels.lowerSingular.toLowerCase()} metrics</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Filter ${displayLabels.lowerPlural.toLowerCase()}`}
                className="h-10 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={downloadTable}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Export CSV
          </button>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[1180px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[210px]" />
              <col className="w-[150px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[var(--surface)] shadow-[0_1px_0_var(--border-soft)]">
              <tr className="border-b border-[var(--border-soft)]">
                {tableColumns.map((column) => (
                  <th key={column.key} className="px-4 py-4 text-left align-bottom">
                    <button
                      type="button"
                      onClick={() => updateSort(column.key)}
                      className={`inline-flex min-h-8 w-full items-center gap-2 whitespace-normal text-[11px] font-semibold uppercase leading-4 tracking-[0.13em] text-[var(--muted-foreground)] ${
                        column.align === "right"
                          ? "justify-end text-right"
                          : column.align === "center"
                            ? "justify-center text-center"
                            : "justify-start text-left"
                      }`}
                    >
                      <span>{column.label}</span>
                      <span aria-hidden="true">
                        {sort.key === column.key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-4 text-left align-bottom text-[11px] font-semibold uppercase leading-4 tracking-[0.13em] text-[var(--muted-foreground)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {sortedRows.length > 0 ? sortedRows.map((row, index) => {
                const rowRenderKey = `${row.rowKey}-${index}`;

                return (
                  <tr key={rowRenderKey} className="align-top">
                    {tableColumns.map((column) => (
                      <td
                        key={`${rowRenderKey}-${column.key}`}
                        className={`px-4 py-3 text-sm text-[var(--foreground)] ${
                          column.align === "right"
                            ? "text-right"
                            : column.align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {formatCellValue(column.render(row))}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {row.link ? (
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          Open source
                        </a>
                      ) : (
                        <span className="text-sm text-[var(--muted-foreground)]">n/a</span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td
                    colSpan={tableColumns.length + 1}
                    className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]"
                  >
                    No {displayLabels.lowerSingular.toLowerCase()} metrics match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
