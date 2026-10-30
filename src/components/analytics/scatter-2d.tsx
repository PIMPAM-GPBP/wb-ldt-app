"use client";

import { useMemo, useOptimistic, useTransition } from "react";

import { EvidenceGapBadge } from "@/components/analytics/evidence-gap-badge";
import { PlotlyChart, getPlotlyTheme, plotlyAxis, plotlyLayout } from "@/components/analytics/plotly-chart";
import { useRenderTheme } from "@/components/analytics/use-render-theme";
import { useSearchParamUpdater } from "@/components/analytics/use-search-param-updater";
import { Button } from "@/components/ui/button";
import type { AdminLabels } from "@/lib/countries";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { deriveScatterEvidenceGap } from "@/lib/evidence-gaps";
import type { MetricDefinition } from "@/types/analytics";

export type Scatter2DCardProps = {
  xMetric: MetricDefinition;
  yMetric: MetricDefinition;
  /** The metrics the axis selects offer. */
  scoreMetrics: MetricDefinition[];
  /** The selected unit's higher admin area; its units stand out from the rest. */
  selectedProvince: string;
  adminLabels: AdminLabels;
  points: Array<{
    id: string;
    label: string;
    district: string;
    province: string;
    x: number | null;
    y: number | null;
    selected: boolean;
  }>;
};

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function axisTitle(metric: MetricDefinition) {
  return metric.unit ? `${metric.name} (${metric.unit})` : metric.name;
}

/** "Prosperity Score" reads as "Prosperity" in a corner label. */
function shortName(metric: MetricDefinition) {
  return metric.name.replace(/\s+score$/i, "");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function AxisSelect({
  id,
  label,
  value,
  metrics,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  metrics: MetricDefinition[];
  onChange: (metricId: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-60"
      >
        {metrics.map((metric) => (
          <option key={metric.id} value={metric.id}>
            {metric.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Scatter2DCard({
  xMetric,
  yMetric,
  scoreMetrics,
  selectedProvince,
  adminLabels,
  points,
}: Scatter2DCardProps) {
  const theme = useRenderTheme();
  const { update, isPending } = useSearchParamUpdater();
  const [, startTransition] = useTransition();
  // The server owns the axes, so the selects would snap back until the new page lands without this.
  const [xValue, setXValue] = useOptimistic(xMetric.id);
  const [yValue, setYValue] = useOptimistic(yMetric.id);

  function changeAxis(axis: "x" | "y", metricId: string) {
    startTransition(() => {
      (axis === "x" ? setXValue : setYValue)(metricId);
      update({ [axis]: metricId });
    });
  }

  const evidenceGap = deriveScatterEvidenceGap(points);
  const lowerSingular = adminLabels.lower.singular;
  const lowerPlural = adminLabels.lower.plural;
  const higherSingular = adminLabels.higher.singular;
  const xTitle = xMetric.name;
  const yTitle = yMetric.name;
  const exportFileName = `${xTitle.toLowerCase().replace(/\s+/g, "-")}-${yTitle.toLowerCase().replace(/\s+/g, "-")}-comparison.csv`;

  function handleCsvDownload() {
    const csv = buildCsv(
      [
        "id",
        lowerSingular,
        adminLabels.middle?.singular ?? "District",
        higherSingular,
        xTitle,
        yTitle,
        "selected",
      ],
      points.map((point) => [
        point.id,
        point.label,
        point.district,
        point.province,
        point.x,
        point.y,
        point.selected,
      ]),
    );

    downloadCsv(exportFileName, csv);
  }

  const chart = useMemo(() => {
    const colors = getPlotlyTheme(theme);
    const visiblePoints = points.filter(
      (point): point is typeof point & { x: number; y: number } => point.x !== null && point.y !== null,
    );
    const selected = visiblePoints.find((point) => point.selected);
    const sameProvince = visiblePoints.filter((point) => !point.selected && point.province === selectedProvince);
    const others = visiblePoints.filter((point) => !point.selected && point.province !== selectedProvince);

    const hoverLocation = adminLabels.middle
      ? `${adminLabels.middle.singular}: %{customdata[2]}<br>${higherSingular}: %{customdata[3]}<br>`
      : `${higherSingular}: %{customdata[3]}<br>`;
    const hovertemplate =
      `<b>%{text}</b><br>${hoverLocation}` +
      `${xTitle}: %{x:.1f}<br>${yTitle}: %{y:.1f}<extra></extra>`;

    const trace = (name: string, group: typeof visiblePoints, marker: Record<string, unknown>) => ({
      type: "scatter",
      mode: "markers",
      name,
      x: group.map((point) => point.x),
      y: group.map((point) => point.y),
      text: group.map((point) => point.label),
      customdata: group.map((point) => [point.id, point.label, point.district, point.province]),
      marker,
      hovertemplate,
    });

    const data = [
      trace(`Other ${lowerFirst(lowerPlural)}`, others, {
        color: colors.inkMuted,
        opacity: 0.4,
        size: 7,
        line: { width: 0 },
      }),
      trace(`In ${selectedProvince}`, sameProvince, {
        color: colors.accent,
        opacity: 0.85,
        size: 8,
        line: { color: colors.page, width: 0.5 },
      }),
      {
        ...trace(selected?.label ?? `Selected ${lowerFirst(lowerSingular)}`, selected ? [selected] : [], {
          color: colors.ink,
          size: 14,
          line: { color: colors.page, width: 2 },
        }),
        showlegend: selected !== undefined,
      },
    ];

    const midline = { color: colors.axis, width: 1 };
    const cornerLabel = (text: string, x: 0 | 1, y: 0 | 1) => ({
      xref: "paper",
      yref: "paper",
      x,
      y,
      xanchor: x === 0 ? "left" : "right",
      yanchor: y === 0 ? "bottom" : "top",
      xshift: x === 0 ? 8 : -8,
      yshift: y === 0 ? 8 : -8,
      text,
      showarrow: false,
      font: { size: 12, color: colors.inkMuted },
    });
    const xName = shortName(xMetric);
    const yName = shortName(yMetric);

    const layout = plotlyLayout(theme, {
      autosize: true,
      height: 560,
      margin: { l: 64, r: 16, t: 40, b: 64 },
      hovermode: "closest",
      legend: {
        orientation: "h",
        x: 0,
        xanchor: "left",
        y: 1.03,
        yanchor: "bottom",
        font: { size: 12, color: colors.inkMuted },
      },
      xaxis: plotlyAxis(theme, {
        title: axisTitle(xMetric),
        range: [0, 100],
        tickvals: [0, 25, 50, 75, 100],
        showgrid: false,
      }),
      yaxis: plotlyAxis(theme, {
        title: axisTitle(yMetric),
        range: [0, 100],
        tickvals: [0, 25, 50, 75, 100],
        showgrid: false,
      }),
      shapes: [
        { type: "line", layer: "below", x0: 50, x1: 50, y0: 0, y1: 100, line: midline },
        { type: "line", layer: "below", x0: 0, x1: 100, y0: 50, y1: 50, line: midline },
      ],
      annotations: [
        cornerLabel(`Low ${xName}, high ${yName}`, 0, 1),
        cornerLabel(`High ${xName}, high ${yName}`, 1, 1),
        cornerLabel(`Low ${xName}, low ${yName}`, 0, 0),
        cornerLabel(`High ${xName}, low ${yName}`, 1, 0),
        ...(selected
          ? [
              {
                xref: "x",
                yref: "y",
                x: selected.x,
                y: selected.y,
                text: `<b>${escapeHtml(selected.label)}</b>`,
                showarrow: true,
                arrowhead: 0,
                arrowwidth: 1,
                arrowcolor: colors.ink,
                standoff: 9,
                ax: selected.x > 70 ? -52 : 52,
                ay: selected.y > 85 ? 40 : -40,
                font: { size: 13, color: colors.ink },
                bgcolor: colors.page,
                borderpad: 3,
              },
            ]
          : []),
      ],
    });

    return { data, layout };
  }, [theme, points, selectedProvince, adminLabels, higherSingular, lowerSingular, lowerPlural, xMetric, yMetric, xTitle, yTitle]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AxisSelect
          id="scatter-x-axis"
          label="X axis"
          value={xValue}
          metrics={scoreMetrics}
          onChange={(metricId) => changeAxis("x", metricId)}
        />
        <AxisSelect
          id="scatter-y-axis"
          label="Y axis"
          value={yValue}
          metrics={scoreMetrics}
          onChange={(metricId) => changeAxis("y", metricId)}
        />
        <Button type="button" variant="outline" size="lg" className="sm:ml-auto" onClick={handleCsvDownload}>
          Download CSV
        </Button>
      </div>
      {evidenceGap ? (
        <div className="mt-3">
          <EvidenceGapBadge gap={evidenceGap} />
        </div>
      ) : null}
      <div className="mt-4 overflow-x-auto" aria-busy={isPending}>
        <PlotlyChart
          className="min-w-[720px]"
          data={chart.data}
          layout={chart.layout}
          config={{ responsive: true, displaylogo: false, displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
          onClick={(event) => {
            const municipalityId = event.points?.[0]?.customdata?.[0];
            if (typeof municipalityId !== "string" || municipalityId.length === 0) {
              return;
            }
            update({ municipality: municipalityId });
          }}
        />
      </div>
      <p className="mt-2 text-sm text-ink-muted sm:hidden">Scroll sideways to see the full chart.</p>
    </div>
  );
}
