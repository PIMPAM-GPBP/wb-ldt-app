"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ComponentType } from "react";

import { pillarHex, type ThemeName } from "@/lib/analytics/derive";
import type { Pillar } from "@/types/analytics";

type PlotlyClickPoint = {
  customdata?: unknown[];
};

type PlotlyClickEvent = {
  points?: PlotlyClickPoint[];
};

export type PlotlyChartProps = {
  className?: string;
  data: unknown[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  style?: CSSProperties;
  useResizeHandler?: boolean;
  onClick?: (event: PlotlyClickEvent) => void;
};

const PlotlyChart = dynamic(async () => {
  const [plotlyModule, scatterModule, barModule, factoryModule] = await Promise.all([
    import("plotly.js/lib/core"),
    import("plotly.js/lib/scatter"),
    import("plotly.js/lib/bar"),
    import("react-plotly.js/factory"),
  ]);

  const Plotly = (plotlyModule as { default?: unknown }).default ?? plotlyModule;
  const scatter = (scatterModule as { default?: unknown }).default ?? scatterModule;
  const bar = (barModule as { default?: unknown }).default ?? barModule;
  (Plotly as { register: (modules: unknown[]) => void }).register([scatter, bar]);

  return factoryModule.default(Plotly as never);
}, { ssr: false }) as ComponentType<PlotlyChartProps>;

const Plotly3DChart = dynamic(async () => {
  const [plotlyModule, scatter3dModule, factoryModule] = await Promise.all([
    import("plotly.js/lib/core"),
    import("plotly.js/lib/scatter3d"),
    import("react-plotly.js/factory"),
  ]);

  const Plotly = (plotlyModule as { default?: unknown }).default ?? plotlyModule;
  const scatter3d = (scatter3dModule as { default?: unknown }).default ?? scatter3dModule;
  (Plotly as { register: (modules: unknown[]) => void }).register([scatter3d]);

  return factoryModule.default(Plotly as never);
}, { ssr: false }) as ComponentType<PlotlyChartProps>;

export { PlotlyChart, Plotly3DChart };

// Plotly draws to SVG and WebGL, so it cannot read CSS variables. These are the globals.css token
// values for each theme; keep them in step with the tokens named beside each one.
const PLOTLY_COLORS: Record<
  ThemeName,
  { ink: string; inkMuted: string; grid: string; axis: string; page: string; surface: string; border: string; accent: string }
> = {
  light: {
    ink: "#1b2340", // --ink
    inkMuted: "#586179", // --ink-muted
    grid: "rgba(55, 66, 145, 0.09)", // --chart-grid
    axis: "rgba(55, 66, 145, 0.32)", // --chart-axis
    page: "#f7f9fd", // --background
    surface: "#ffffff", // --surface-strong
    border: "#dbddeb", // --border-strong over --surface-strong, opaque for hover labels
    accent: "#3675b7", // --accent
  },
  dark: {
    ink: "#f5f7ff",
    inkMuted: "#a9b4cf",
    grid: "rgba(201, 211, 234, 0.12)",
    axis: "rgba(201, 211, 234, 0.3)",
    page: "#021420",
    surface: "#0b2536",
    border: "#394f61",
    accent: "#8fa8df",
  },
};

const PLOTLY_FONT_FAMILY = 'Inter, "Roboto", "Arial", sans-serif';

export type PlotlyTheme = (typeof PLOTLY_COLORS)[ThemeName] & {
  fontFamily: string;
  /** Pillar colors for this theme, the same hex values the map and the beeswarm use. */
  pillars: Record<Pillar, string>;
};

/** Literal colors and the font for a theme, for traces, markers, and annotations. */
export function getPlotlyTheme(theme: ThemeName): PlotlyTheme {
  return {
    ...PLOTLY_COLORS[theme],
    fontFamily: PLOTLY_FONT_FAMILY,
    pillars: {
      prosperity: pillarHex("prosperity", theme),
      infrastructure: pillarHex("infrastructure", theme),
      livability: pillarHex("livability", theme),
    },
  };
}

/**
 * Base layout in the site's chart style: Inter in ink, transparent backgrounds so the page shows
 * through, and a hover label that matches the floating panels. Pass overrides for everything else.
 * Opt in with `layout={plotlyLayout(theme, { ... })}`; charts that build their own layout are unchanged.
 */
export function plotlyLayout(theme: ThemeName, overrides: Record<string, unknown> = {}) {
  const colors = PLOTLY_COLORS[theme];
  return {
    font: { family: PLOTLY_FONT_FAMILY, size: 13, color: colors.ink },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    hoverlabel: {
      bgcolor: colors.surface,
      bordercolor: colors.border,
      align: "left",
      font: { family: PLOTLY_FONT_FAMILY, size: 13, color: colors.ink },
    },
    legend: { font: { size: 12, color: colors.inkMuted } },
    modebar: { bgcolor: "rgba(0,0,0,0)", color: colors.inkMuted, activecolor: colors.ink },
    ...overrides,
  };
}

/**
 * One axis in the same style: quiet gridlines, a single axis line, muted tick labels, and a title in ink.
 * `title` is plain text; everything else passes straight to Plotly. Works for 2D axes and 3D scene axes.
 */
export function plotlyAxis(theme: ThemeName, { title, ...overrides }: { title?: string } & Record<string, unknown> = {}) {
  const colors = PLOTLY_COLORS[theme];
  return {
    showgrid: true,
    gridcolor: colors.grid,
    zeroline: false,
    showline: true,
    linecolor: colors.axis,
    ticks: "outside",
    tickcolor: colors.axis,
    ticklen: 4,
    tickfont: { size: 12, color: colors.inkMuted },
    ...(title === undefined ? {} : { title: { text: title, font: { size: 13, color: colors.ink }, standoff: 10 } }),
    ...overrides,
  };
}
