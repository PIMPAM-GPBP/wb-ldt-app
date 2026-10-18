import { readFile } from "node:fs/promises";
import path from "node:path";

import Image from "next/image";

import pilDiagram from "../../images/PIL Diagram v2.png";
import { CountrySelector } from "@/components/home/country-selector";
import nplAnalyticsData from "@/generated/analytics-data.json";
import serbiaAnalyticsData from "@/generated/serbia/analytics-data.json";
import zambiaAnalyticsData from "@/generated/zambia/analytics-data.json";
import { countries } from "@/lib/countries";

const analyticsDatasets = [
  nplAnalyticsData,
  serbiaAnalyticsData,
  zambiaAnalyticsData,
] as const;

const totalLoadedLsgsFromImports = analyticsDatasets.reduce(
  (sum, dataset) => sum + dataset.coverage.analyticsMunicipalityCount,
  0,
);
const latestDataYearFromImports = Math.max(
  ...analyticsDatasets.map((dataset) => dataset.release.year),
);

// Vietnam's generated dataset is far larger than the other countries' fallback files, so it is
// read lazily at request time instead of being statically imported into the page bundle.
async function loadVietnamSummary() {
  try {
    const filePath = path.join(
      process.cwd(),
      "src/generated/vietnam/analytics-data.json",
    );
    const raw = await readFile(filePath, "utf8");
    const dataset = JSON.parse(raw) as {
      coverage: { analyticsMunicipalityCount: number };
      release: { year: number };
    };

    return {
      analyticsMunicipalityCount: dataset.coverage.analyticsMunicipalityCount,
      year: dataset.release.year,
    };
  } catch {
    return { analyticsMunicipalityCount: 0, year: 0 };
  }
}

const capabilityCards = [
  {
    title: "Compare places",
    body: "Inspect municipalities across composite score space, peer positions, and provincial or national baselines.",
  },
  {
    title: "Read the map",
    body: "Move from pillar and indicator choropleths into municipality context, coverage, and score drivers.",
  },
  {
    title: "Trace evidence",
    body: "Keep methodology, plan sources, release notes, and data limitations close to each analytical result.",
  },
  {
    title: "Synthesize plans",
    body: "Use AI-assisted narratives, SWOT framing, and investment recommendations as inspectable planning outputs.",
  },
] as const;

export default async function Home() {
  const vietnamSummary = await loadVietnamSummary();
  const totalLoadedLsgs =
    totalLoadedLsgsFromImports + vietnamSummary.analyticsMunicipalityCount;
  const latestDataYear = Math.max(
    latestDataYearFromImports,
    vietnamSummary.year,
  );

  const homeStats = [
    {
      value: String(countries.length),
      label: "Country workspaces",
    },
    {
      value: totalLoadedLsgs.toLocaleString("en-US"),
      label: "LSGs currently loaded",
    },
    {
      value: String(latestDataYear),
      label: "Latest data year",
    },
  ] as const;

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-[var(--border-soft)] bg-[radial-gradient(circle_at_top,var(--hero-glow),transparent_38%),linear-gradient(180deg,var(--hero-wash-start),var(--hero-wash-end))]">
        <div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-4xl">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
              Local Development Tracker for public investment decisions.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
              A country workspace for comparing local development conditions, reading
              municipality-level score drivers, and linking planning evidence to public investment
              choices.
            </p>
            <div className="mt-8 grid max-w-[48rem] gap-3 sm:grid-cols-3">
              {homeStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-h-28 flex-col justify-between rounded-[1.25rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-[0_14px_34px_rgba(2,20,32,0.07)]"
                >
                  <p className="font-mono text-2xl font-semibold text-[var(--foreground)]">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-[11px] font-medium uppercase leading-5 tracking-[0.14em] text-[var(--muted-foreground)]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <CountrySelector />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <article className="overflow-hidden rounded-[1.7rem] border border-[var(--border-soft)] bg-white/78 p-5 shadow-[0_18px_45px_rgba(2,20,32,0.08)] sm:p-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Public investment lens
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                From local evidence to investment decisions
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
              The PIL framework links local development conditions, planning evidence,
              and investment prioritization so users can move from diagnostics to
              practical public investment conversations.
            </p>
          </div>
          <div className="mt-6 rounded-[1.25rem] border border-[var(--border-soft)] bg-white p-4">
            <Image
              src={pilDiagram}
              alt="PIL framework diagram linking planning evidence, investment logic, and local development outcomes"
              className="h-auto w-full rounded-[1rem]"
              priority
            />
          </div>
        </article>
      </section>

      <section className="mx-auto my-12 w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <article className="rounded-[1.7rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,var(--panel-gradient-start),var(--panel-gradient-end))] p-6 shadow-[0_18px_45px_var(--surface-shadow)] sm:p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            What the LDT provides
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map((capability) => (
              <div
                key={capability.title}
                className="rounded-[1.2rem] border border-[var(--border-soft)] bg-white/75 p-5"
              >
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {capability.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  {capability.body}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

    </main>
  );
}
