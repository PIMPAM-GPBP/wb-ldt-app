"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
};

function useHasHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className, labelClassName, iconClassName }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const hasHydrated = useHasHydrated();
  const label = hasHydrated
    ? isDark
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";
  const statusLabel = hasHydrated ? (isDark ? "Dark" : "Light") : "Theme";

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={toggleTheme}
      className={cn(
        "h-10 rounded-md border-[var(--border-soft)] bg-[var(--surface)] px-3 text-[var(--foreground)] hover:bg-[var(--surface-strong)]",
        className,
      )}
      aria-label={label}
      title={label}
      aria-pressed={hasHydrated ? isDark : undefined}
    >
      {hasHydrated && isDark ? (
        <Sun aria-hidden="true" className={iconClassName} />
      ) : (
        <Moon aria-hidden="true" className={iconClassName} />
      )}
      <span className={cn("hidden text-sm font-medium xl:inline", labelClassName)}>
        {statusLabel}
      </span>
    </Button>
  );
}
