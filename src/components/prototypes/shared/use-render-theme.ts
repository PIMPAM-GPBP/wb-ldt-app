"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "@/components/theme/theme-provider";

import type { ThemeName } from "./derive";

const subscribeNever = () => () => {};

/**
 * The theme to compute colors with. The server always renders light, so this stays light until
 * hydration finishes; otherwise a dark-mode visit hydrates light swatch colors that React never patches.
 */
export function useRenderTheme(): ThemeName {
  const { isDark } = useTheme();
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  return hydrated && isDark ? "dark" : "light";
}
