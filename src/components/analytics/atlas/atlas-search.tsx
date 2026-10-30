"use client";

import { type KeyboardEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING, PANEL_LABEL, TEXT_FIELD } from "./panel-styles";

export type AtlasSearchProps = {
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Visible label, for example "Find a municipality". */
  label: string;
  /** Replaces the panel label style, for use outside a tool panel. */
  labelClassName?: string;
};

const MAX_RESULTS = 8;

/**
 * Option labels read "Unit, District". Serbia and Zambia often name a unit after its district,
 * so "Bor, Bor" becomes "Bor". Other labels pass through.
 */
export function tidyUnitOptions(options: AtlasSearchProps["options"]) {
  return options.map((option) => ({ ...option, label: option.label.replace(/^(.+), \1$/, "$1") }));
}

function MatchedLabel({ label, needle }: { label: string; needle: string }) {
  const start = label.toLowerCase().indexOf(needle);
  if (start === -1) return <>{label}</>;
  return (
    <>
      {label.slice(0, start)}
      <span className="font-medium">{label.slice(start, start + needle.length)}</span>
      {label.slice(start + needle.length)}
    </>
  );
}

export function AtlasSearch({ options, selectedId, onSelect, label, labelClassName = PANEL_LABEL }: AtlasSearchProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const needle = query.trim().toLowerCase();
  const results = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle)).slice(0, MAX_RESULTS)
    : [];
  const isOpen = open && needle.length > 0;
  const index = Math.min(activeIndex, Math.max(results.length - 1, 0));
  const highlighted = results[index];
  const selectedLabel = options.find((option) => option.id === selectedId)?.label;
  const optionDomId = (position: number) => `${baseId}-option-${position}`;

  function choose(id: string) {
    onSelect(id);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) setOpen(true);
      else if (results.length > 0) setActiveIndex(Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) setActiveIndex(Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (isOpen && highlighted) {
        event.preventDefault();
        choose(highlighted.id);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className={cn("mb-1.5 block", labelClassName)}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          type="text"
          value={query}
          placeholder={selectedLabel ?? "Search"}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={isOpen && highlighted ? optionDomId(index) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={cn(TEXT_FIELD, FOCUS_RING)}
        />
        <div
          hidden={!isOpen}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-float"
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            hidden={results.length === 0}
            className="max-h-80 overflow-y-auto p-1"
          >
            {results.map((option, position) => (
              <li
                key={option.id}
                id={optionDomId(position)}
                role="option"
                aria-selected={position === index}
                onMouseEnter={() => setActiveIndex(position)}
                onClick={() => choose(option.id)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center rounded-md px-2.5 text-sm text-ink md:min-h-9",
                  position === index && "bg-[var(--accent-soft)]",
                )}
              >
                <MatchedLabel label={option.label} needle={needle} />
              </li>
            ))}
          </ul>
          {isOpen && results.length === 0 ? (
            <p role="status" className="px-2.5 py-2 text-sm text-ink-muted">
              No matches
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
