"use client";

import { useMemo } from "react";

import { Plotly3DChart, getPlotlyTheme, plotlyAxis, plotlyLayout } from "@/components/analytics/plotly-chart";
import { useRenderTheme } from "@/components/analytics/use-render-theme";
import { useSearchParamUpdater } from "@/components/analytics/use-search-param-updater";
import type { AdminLabels } from "@/lib/countries";

export type Scatter3DCardProps = {
  selectedProvince: string;
  adminLabels: AdminLabels;
  points: Array<{
    id: string;
    label: string;
    district: string;
    province: string;
    x: number | null;
    y: number | null;
    z: number | null;
    selected: boolean;
  }>;
};

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function Scatter3DCard({ selectedProvince, adminLabels, points }: Scatter3DCardProps) {
  const theme = useRenderTheme();
  const { update } = useSearchParamUpdater();
  const lowerSingular = adminLabels.lower.singular;
  const lowerPlural = adminLabels.lower.plural;
  const higherSingular = adminLabels.higher.singular;

  const chart = useMemo(() => {
    const colors = getPlotlyTheme(theme);
    const visiblePoints = points.filter(
      (point): point is typeof point & { x: number; y: number; z: number } =>
        point.x !== null && point.y !== null && point.z !== null,
    );
    const selected = visiblePoints.find((point) => point.selected);
    const sameProvince = visiblePoints.filter((point) => !point.selected && point.province === selectedProvince);
    const others = visiblePoints.filter((point) => !point.selected && point.province !== selectedProvince);

    const hoverLocation = adminLabels.middle
      ? `${adminLabels.middle.singular}: %{customdata[2]}<br>${higherSingular}: %{customdata[3]}<br>`
      : `${higherSingular}: %{customdata[3]}<br>`;
    const hovertemplate =
      `<b>%{text}</b><br>${hoverLocation}` +
      "Prosperity: %{x:.1f}<br>Infrastructure: %{y:.1f}<br>Livability: %{z:.1f}<extra></extra>";

    const trace = (name: string, group: typeof visiblePoints, marker: Record<string, unknown>) => ({
      type: "scatter3d",
      mode: "markers",
      name,
      x: group.map((point) => point.x),
      y: group.map((point) => point.y),
      z: group.map((point) => point.z),
      text: group.map((point) => point.label),
      customdata: group.map((point) => [point.id, point.label, point.district, point.province]),
      marker,
      hovertemplate,
    });

    const data = [
      trace(`Other ${lowerFirst(lowerPlural)}`, others, { color: colors.inkMuted, opacity: 0.4, size: 4 }),
      trace(`In ${selectedProvince}`, sameProvince, { color: colors.accent, opacity: 0.85, size: 5 }),
      {
        ...trace(selected?.label ?? `Selected ${lowerFirst(lowerSingular)}`, selected ? [selected] : [], {
          color: colors.ink,
          size: 11,
          line: { color: colors.page, width: 2 },
        }),
        showlegend: selected !== undefined,
      },
    ];

    const sceneAxis = (title: string) =>
      plotlyAxis(theme, { title, range: [0, 100], showbackground: false, gridcolor: colors.axis });

    const layout = plotlyLayout(theme, {
      autosize: true,
      height: 640,
      margin: { l: 0, r: 0, t: 32, b: 0 },
      legend: {
        orientation: "h",
        x: 0,
        xanchor: "left",
        y: 1,
        yanchor: "bottom",
        font: { size: 12, color: colors.inkMuted },
      },
      scene: {
        xaxis: sceneAxis("Prosperity"),
        yaxis: sceneAxis("Infrastructure"),
        zaxis: sceneAxis("Livability"),
        bgcolor: "rgba(0,0,0,0)",
        aspectmode: "cube",
        camera: { eye: { x: 1.3, y: 1.25, z: 0.85 } },
      },
    });

    return { data, layout };
  }, [theme, points, selectedProvince, adminLabels, higherSingular, lowerSingular, lowerPlural]);

  return (
    <Plotly3DChart
      data={chart.data}
      layout={chart.layout}
      config={{ responsive: true, displaylogo: false }}
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
  );
}
