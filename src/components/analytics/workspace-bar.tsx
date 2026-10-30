"use client";

import Link, { useLinkStatus } from "next/link";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { AtlasSearch, tidyUnitOptions } from "@/components/analytics/atlas/atlas-search";
import { FOCUS_RING } from "@/components/analytics/atlas/panel-styles";
import { useSearchParamUpdater } from "@/components/analytics/use-search-param-updater";
import type { AdminLabels } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * The workspace's URL state. One updater serves the bar, the rail, the search and the ranking table,
 * so a single pending flag drives the bar's progress line for all of them.
 * It renders the page's `main`, which carries the two heights the map stage is sized from.
 */
type Workspace = { update: (updates: Record<string, string | null>) => void; isPending: boolean };

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { update, isPending } = useSearchParamUpdater();
  const value = useMemo(() => ({ update, isPending }), [update, isPending]);
  const main = useRef<HTMLElement>(null);

  // The sticky app header is taller on wide screens and will change again, so measure it.
  // The CSS value is only the first paint. The bar is h-12 plus its 1px border from lg up.
  useEffect(() => {
    const header = document.querySelector("header");
    const node = main.current;
    if (!header || !node) return;
    const sync = () => node.style.setProperty("--app-header-h", `${header.getBoundingClientRect().height}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <WorkspaceContext value={value}>
      <main ref={main} className="flex flex-1 flex-col [--app-header-h:81px] [--workspace-bar-h:49px]">
        {children}
      </main>
    </WorkspaceContext>
  );
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace needs a WorkspaceProvider above it");
  return workspace;
}

const PENDING_KEYFRAMES = "@keyframes workspace-pending{from{transform:translateX(-100%)}to{transform:translateX(250%)}}";

/** A 2px progress line that sweeps while `active`. Reduced motion shows a static half-opacity line. */
function PendingLine({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-0.5 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none",
        active ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <span
        className={cn(
          "block h-full w-2/5 bg-[var(--accent-strong)] motion-reduce:w-full motion-reduce:opacity-50",
          active && "[animation:workspace-pending_1.2s_linear_infinite] motion-reduce:[animation:none]",
        )}
      />
    </span>
  );
}

// useLinkStatus reads the Link it sits in, so it needs its own component.
function LinkPendingLine() {
  const { pending } = useLinkStatus();
  return <PendingLine active={pending} className="bottom-0" />;
}

export type WorkspaceView = { id: string; label: string; href: string };

function ViewLink({ view, active }: { view: WorkspaceView; active: boolean }) {
  return (
    <Link
      href={view.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center whitespace-nowrap text-sm transition-colors duration-150 motion-reduce:transition-none lg:min-h-12",
        active ? "font-medium text-ink" : "text-ink-muted hover:text-ink",
        FOCUS_RING,
      )}
    >
      {view.label}
      {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent-strong)]" /> : null}
      <LinkPendingLine />
    </Link>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  isPending,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  isPending: boolean;
}) {
  const id = useId();
  // The server owns the value. Show the choice at once and hand control back when the render lands.
  const [draft, setDraft] = useState<{ value: string; from: string } | null>(null);
  const shown = isPending && draft?.from === value ? draft.value : value;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* The select's own value says what it filters, so below sm the label is for screen readers only. */}
      <label htmlFor={id} className="sr-only text-sm text-ink-muted sm:not-sr-only">
        {label}
      </label>
      <div className="relative min-w-0">
        <select
          id={id}
          value={shown}
          onChange={(event) => {
            setDraft({ value: event.target.value, from: value });
            onChange(event.target.value);
          }}
          className={cn(
            "h-11 w-full min-w-0 max-w-48 appearance-none truncate rounded-md border border-[var(--border-strong)] bg-[var(--surface)] py-0 pl-2.5 pr-8 text-base text-ink md:h-9 md:text-sm",
            FOCUS_RING,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      </div>
    </div>
  );
}

export type WorkspaceBarProps = {
  countryName: string;
  adminLabels: AdminLabels;
  year: number;
  /** Units in the current year and province filter. */
  unitCount: number;
  years: number[];
  /** Province options as the data layer lists them, with "all" first. */
  provinces: string[];
  province: string;
  views: WorkspaceView[];
  activeViewId: string;
};

export function WorkspaceBar({
  countryName,
  adminLabels,
  year,
  unitCount,
  years,
  provinces,
  province,
  views,
  activeViewId,
}: WorkspaceBarProps) {
  const { update, isPending } = useWorkspace();
  const higherSingular = adminLabels.higher.singular;
  const higherPlural = adminLabels.higher.plural.toLowerCase();

  return (
    <div className="relative border-b border-[var(--border-soft)] bg-[var(--surface)] lg:sticky lg:top-[var(--app-header-h)] lg:z-30 print:hidden">
      <style>{PENDING_KEYFRAMES}</style>
      <PendingLine active={isPending} className="top-0" />
      <span role="status" className="sr-only">
        {isPending ? "Updating" : ""}
      </span>
      <div className="mx-auto flex w-full max-w-[95vw] flex-col px-4 pt-2 sm:px-6 lg:h-12 lg:flex-row lg:items-center lg:gap-x-8 lg:px-10 lg:py-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h1 className="font-heading text-base font-semibold leading-tight text-ink">
            {countryName} <span className="font-normal tabular-nums text-ink-muted">{year}</span>
          </h1>
          <p className="text-sm tabular-nums text-ink-muted">
            {unitCount.toLocaleString("en-US")} {adminLabels.lower.plural.toLowerCase()}
          </p>
        </div>

        <nav aria-label="Analytics views" className="-mx-1 flex gap-x-6 overflow-x-auto px-1 lg:mx-0 lg:px-0">
          {views.map((view) => (
            <ViewLink key={view.id} view={view} active={view.id === activeViewId} />
          ))}
        </nav>

        <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2 lg:ml-auto lg:flex-nowrap lg:pb-0">
          <FilterSelect
            label="Year"
            value={String(year)}
            options={years.map((entry) => ({ value: String(entry), label: String(entry) }))}
            onChange={(next) => update({ year: next })}
            isPending={isPending}
          />
          <FilterSelect
            label={higherSingular}
            value={province}
            options={provinces.map((entry) => ({
              value: entry,
              label: entry === "all" ? `All ${higherPlural}` : entry,
            }))}
            onChange={(next) => update({ province: next })}
            isPending={isPending}
          />
        </div>
      </div>
    </div>
  );
}

/** The unit search for views without a map: a plain field that sets the municipality in the URL. */
export function WorkspaceUnitSearch({
  options,
  selectedId,
  label,
}: {
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  label: string;
}) {
  const { update } = useWorkspace();
  const unitOptions = useMemo(() => tidyUnitOptions(options), [options]);
  return (
    <AtlasSearch
      options={unitOptions}
      selectedId={selectedId}
      onSelect={(id) => update({ municipality: id })}
      label={label}
      labelClassName="text-sm text-ink-muted"
    />
  );
}
