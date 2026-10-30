"use client";

import { useState, type ReactNode } from "react";

import { PILLARS } from "@/lib/analytics/derive";
import type { Pillar } from "@/types/analytics";

/**
 * Colors server-rendered pillar maps by one pillar at a time; it only switches which fills
 * apply (see pillarMapStyles). Native radios give the keyboard behavior.
 */
export function PillarMapSwitch({ classes, note, name, children }: { classes: number; note: string; name: string; children: ReactNode }) {
  const [pillar, setPillar] = useState<Pillar>("prosperity");
  return (
    <div data-map-pillar={pillar}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <fieldset>
          <legend className="text-sm text-ink-muted">Color by</legend>
          <div className="mt-2 inline-flex rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] p-0.5">
            {PILLARS.map((entry) => (
              <label key={entry.id} className="relative">
                <input
                  type="radio"
                  name={name}
                  value={entry.id}
                  checked={pillar === entry.id}
                  onChange={() => setPillar(entry.id)}
                  className="peer sr-only"
                />
                <span className="flex cursor-pointer items-center gap-2 rounded-[3px] px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 peer-checked:bg-[var(--surface-muted)] peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent hover:text-ink motion-reduce:transition-none">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: entry.cssVar }} />
                  {entry.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="text-xs text-ink-muted print:hidden">
          <div className="flex items-center gap-2">
            <span>Lower</span>
            <span className="flex gap-0.5" aria-hidden="true">
              {Array.from({ length: classes }, (_, index) => (
                <span key={index} data-swatch={index} className="h-2.5 w-7 rounded-[2px]" />
              ))}
            </span>
            <span>Higher</span>
          </div>
          <p className="mt-1">{note}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
