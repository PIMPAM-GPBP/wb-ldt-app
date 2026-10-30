"use client";

import { useEffect } from "react";

import { useSearchParamUpdater } from "./shared/use-search-param-updater";
import { VARIANTS, type VariantId } from "./shared/types";

/** Floating switcher for comparing the three directions. Keys 1, 2 and 3 switch too. */
export function VariantSwitcher({ active }: { active: VariantId }) {
  const { update, isPending } = useSearchParamUpdater();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const variant = VARIANTS.find((entry) => entry.key === event.key);
      if (variant && variant.id !== active) update({ v: variant.id });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, update]);

  return (
    <nav
      aria-label="Prototype direction"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-[var(--proto-radius-panel)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface-raised)] p-1 text-sm shadow-[var(--proto-elevation)]"
    >
      {VARIANTS.map((variant) => (
        <button
          key={variant.id}
          type="button"
          aria-pressed={variant.id === active}
          onClick={() => update({ v: variant.id })}
          className="rounded-[var(--proto-radius-control)] px-3 py-1.5 font-medium text-[var(--proto-muted)] transition-colors hover:text-[var(--proto-ink)] aria-pressed:bg-[var(--proto-accent)] aria-pressed:text-[var(--proto-surface)]"
        >
          {variant.label}
          <kbd className="ml-2 font-sans text-xs opacity-60">{variant.key}</kbd>
        </button>
      ))}
      <span aria-live="polite" className="w-16 px-2 text-xs text-[var(--proto-muted)]">
        {isPending ? "Loading" : ""}
      </span>
    </nav>
  );
}
