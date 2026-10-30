"use client";

import Link from "next/link";
import { type ReactNode, startTransition, useId, useOptimistic } from "react";

import type { Country } from "@/lib/countries";
import type { AnalyticsPageData } from "@/types/analytics";

import { PILLARS, formatDelta, formatScore, getPillarStandings } from "../shared/derive";

export type MinimalSidebarProps = {
  data: AnalyticsPageData;
  country: Country;
  /** From useSearchParamUpdater().update. Applies immediately. */
  onUpdate: (updates: Record<string, string | null>) => void;
  isPending: boolean;
};

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--proto-link)]";
const PANEL_LABEL = "text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--proto-muted)]";
const CONTROL = `h-9 max-md:h-11 w-full min-w-0 rounded-[var(--proto-radius-control)] border border-[var(--proto-rule-strong)] bg-[var(--proto-surface)] px-2.5 text-sm text-[var(--proto-ink)] ${FOCUS_RING}`;
const SECTION_RULE = "border-t border-[var(--proto-rule)]";

export function MinimalSidebar({ data, country, onUpdate, isPending }: MinimalSidebarProps) {
  const { adminLabels } = country;
  const { municipality, selected, filters } = data;

  // Each select shows its new value at once. Without this the controlled value snaps back
  // until the server render lands with the new URL.
  const [optimisticYear, setOptimisticYear] = useOptimistic(String(selected.year));
  const [optimisticProvince, setOptimisticProvince] = useOptimistic(selected.province);
  const [optimisticUnit, setOptimisticUnit] = useOptimistic(selected.municipalityId);

  const context = new URLSearchParams({
    year: String(selected.year),
    province: selected.province,
    municipality: selected.municipalityId,
    metric: selected.metricId,
  });
  const views = [
    { label: "Compare scores", href: `/${country.slug}/analytics?${context}&tab=multi`, current: false },
    { label: "Map and drivers", href: `/${country.slug}/analytics/prototypes?${context}&v=minimal`, current: true },
    { label: "Planning brief", href: `/${country.slug}/analytics?${context}&tab=ai`, current: false },
  ];

  // filters.provinces already starts with "all", so only its label changes.
  const higherPlural = adminLabels.higher.plural.toLowerCase();
  const locationLine = [
    adminLabels.middle ? `${adminLabels.middle.singular}: ${municipality.district}` : null,
    `${adminLabels.higher.singular}: ${municipality.province}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const standings = getPillarStandings(data);

  return (
    <aside aria-label="Analytics sidebar" className="flex flex-col text-[var(--proto-ink)]">
      <nav aria-label="Analytics views" className="pb-5">
        <ul>
          {views.map((view) => (
            <li key={view.label}>
              <Link
                href={view.href}
                aria-current={view.current ? "page" : undefined}
                className={`flex h-10 items-center border-l-2 pl-3 text-sm max-md:h-11 ${FOCUS_RING} ${
                  view.current
                    ? "border-[var(--proto-accent)] font-medium text-[var(--proto-ink)]"
                    : "border-transparent text-[var(--proto-muted)] hover:text-[var(--proto-ink)]"
                }`}
              >
                {view.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-label="Filters" className={`${SECTION_RULE} py-5`}>
        <div className="flex flex-col gap-4">
          <FilterSelect
            label="Year"
            value={optimisticYear}
            onChange={(value) => startTransition(() => {
              setOptimisticYear(value);
              onUpdate({ year: value });
            })}
          >
            {filters.years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label={adminLabels.higher.singular}
            value={optimisticProvince}
            onChange={(value) => startTransition(() => {
              setOptimisticProvince(value);
              onUpdate({ province: value, municipality: null });
            })}
          >
            {filters.provinces.map((province) => (
              <option key={province} value={province}>
                {province === "all" ? `All ${higherPlural}` : province}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label={adminLabels.lower.singular}
            value={optimisticUnit}
            onChange={(value) => startTransition(() => {
              setOptimisticUnit(value);
              onUpdate({ municipality: value });
            })}
          >
            {filters.municipalities.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </FilterSelect>

          <p aria-live="polite" className="h-4 text-xs leading-4 text-[var(--proto-muted)]">
            {isPending ? "Updating" : null}
          </p>
        </div>
      </section>

      <div className={`${SECTION_RULE} pt-5`}>
        <h2 className="font-heading text-xl font-semibold leading-tight text-[var(--proto-ink)]">
          {municipality.municipality}
        </h2>
        <p className="mt-2 text-sm text-[var(--proto-muted)]">{locationLine}</p>
        <p className="text-sm tabular-nums text-[var(--proto-muted)]">
          Population: {municipality.context.population?.toLocaleString("en-US") ?? "n/a"}
        </p>

        <dl className="mt-5">
          {standings.map((standing) => {
            const pillar = PILLARS.find((entry) => entry.id === standing.pillar);
            const direction = trendOf(standing.delta);

            return (
              <div
                key={standing.pillar}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-[var(--proto-rule)] py-3 first:border-t-0 first:pt-0"
              >
                <dt className="flex min-w-0 items-center gap-2 text-sm text-[var(--proto-ink)]">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: pillar?.cssVar }}
                  />
                  {pillar?.label ?? standing.label}
                </dt>
                <dd className="text-right font-heading text-lg font-semibold tabular-nums text-[var(--proto-ink)]">
                  {formatScore(standing.value, 1)}
                </dd>
                <dd className="col-span-2 mt-1 flex items-center gap-1.5 text-xs tabular-nums text-[var(--proto-muted)]">
                  {direction ? <Trend direction={direction} /> : null}
                  <span>
                    {formatDelta(standing.delta, 1)} vs national {formatScore(standing.national, 1)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={PANEL_LABEL}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={CONTROL}>
        {children}
      </select>
    </div>
  );
}

/** Deltas that round to 0.0 get no arrow. */
function trendOf(delta: number | null): "up" | "down" | null {
  if (delta === null || Math.abs(delta) < 0.05) return null;
  return delta > 0 ? "up" : "down";
}

function Trend({ direction }: { direction: "up" | "down" }) {
  const tone = direction === "up" ? "text-[var(--proto-above)]" : "text-[var(--proto-below)]";

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 8 8" className={`size-2 shrink-0 fill-current ${tone}`}>
      <path d={direction === "up" ? "M4 1 7 7H1Z" : "M1 1H7L4 7Z"} />
    </svg>
  );
}
