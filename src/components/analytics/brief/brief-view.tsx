import Link from "next/link";

import { BriefActions } from "@/components/analytics/brief/brief-actions";
import { ChartKey, ComponentDot, Delta, ScoreBar, ScoreStrip, Sparkline } from "@/components/analytics/brief/brief-charts";
import { PILLARS, formatScore } from "@/lib/analytics/derive";
import {
  DATA_NOTE,
  MACHINE_TRANSLATION_LABEL,
  bandNote,
  briefStatus,
  editionLine,
  paragraphsOf,
  planDocumentsNote,
  planSourceNote,
  planStatusLine,
  type BriefData,
  type BriefPlanDocument,
  type PillarVisual,
  type PlanPillar,
} from "@/lib/brief/document";
import type { Fact } from "@/lib/brief/facts";
import type { BriefSentence, SentencePart } from "@/lib/brief/section-one";
import { cn } from "@/lib/utils";

const LINK =
  "rounded-sm text-accent underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";

const pillarName = (label: string) => label.replace(/ Score$/, "");
const colorOf = (key: PillarVisual["key"]) => PILLARS.find((pillar) => pillar.id === key)?.cssVar ?? "var(--accent)";
/** Component values are whole numbers; averages carry one decimal. */
const formatValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** A piece of a sentence. A number bound to a fact shows the fact's description on hover. */
function Part({ part, brief, facts = brief.facts }: { part: SentencePart; brief: BriefData; facts?: Record<string, Fact> }) {
  if (typeof part === "string") return part;
  const fact = facts[part.factId];
  const numeric = typeof fact?.value === "number";
  return (
    <span
      data-fact-id={`${brief.sheetId}.${part.factId}`}
      title={fact ? fact.label : undefined}
      className={numeric ? "tabular-nums underline decoration-[var(--border-strong)] decoration-dotted underline-offset-[3px] print:no-underline" : undefined}
    >
      {part.text}
    </span>
  );
}

function Sentences({ sentences, brief, facts }: { sentences: readonly BriefSentence[]; brief: BriefData; facts?: Record<string, Fact> }) {
  return sentences.map((sentence, index) => (
    <span key={index}>
      {index > 0 ? " " : null}
      {sentence.parts.map((part, partIndex) => (
        <Part key={partIndex} part={part} brief={brief} facts={facts} />
      ))}
    </span>
  ));
}

function PlanList({ documents }: { documents: readonly BriefPlanDocument[] }) {
  if (documents.length === 0) return <p className="mt-1.5 text-sm text-ink-muted">None listed.</p>;
  return (
    <ul className="mt-1.5 space-y-1">
      {documents.map((document) => (
        <li key={document.link} className="text-sm leading-6 text-ink">
          <a href={document.link} target="_blank" rel="noreferrer" className={LINK}>
            {document.title}
          </a>
          {document.documentType ? <span className="text-ink-muted"> ({document.documentType})</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** The three scores side by side: value, band, gap to the national average, and where the unit sits among all units. */
function ScoresAtAGlance({ brief }: { brief: BriefData }) {
  const unitPlural = brief.country.unit.plural.toLowerCase();
  return (
    <section aria-labelledby="brief-glance" className="mt-8">
      <h2 id="brief-glance" className="sr-only">
        Scores at a glance
      </h2>
      <ul className="grid divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {brief.visuals.map((visual) => {
          const gap = visual.score !== null && visual.national !== null ? visual.score - visual.national : null;
          return (
            <li key={visual.key} className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
              <a href={`#brief-${visual.key}`} className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:outline-solid">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(visual.key) }} />
                  <span className="group-hover:underline group-hover:underline-offset-2">{pillarName(visual.label)}</span>
                </span>
                <span className="mt-3 flex items-end justify-between gap-4">
                  <span className="font-heading text-4xl leading-none font-semibold tabular-nums text-ink">{formatScore(visual.score, 1)}</span>
                  <span className="text-right text-xs leading-5 text-ink-muted">
                    <span className="block">
                      <Delta value={gap} /> vs national
                    </span>
                    {visual.band ? (
                      <span className="block">
                        {visual.band} of {brief.unitCount}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="mt-4 block">
                  <ScoreStrip distribution={visual.distribution} value={visual.score} national={visual.national} province={visual.province} color={colorOf(visual.key)} />
                </span>
                <span className="sr-only">
                  {pillarName(visual.label)} score {formatScore(visual.score, 1)}
                  {visual.band ? `, ${lowerFirst(visual.band)} of ${brief.unitCount} ${unitPlural}` : ""}; national average {formatScore(visual.national, 1)}, {brief.unit.province} average{" "}
                  {formatScore(visual.province, 1)}.
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <ChartKey unitName={brief.unit.name} provinceName={brief.unit.province} unitSingular={brief.country.unit.singular.toLowerCase()} />
      </div>
    </section>
  );
}

type PlanRow = PlanPillar["coverage"]["rows"][number];

/**
 * Each component as a dot on a 0 to 100 axis against the national and province averages,
 * with the plan's commitments beside it when the plan sections are public.
 */
function ComponentRows({ visual, plan }: { visual: PillarVisual; plan: Map<string, PlanRow> | null }) {
  const color = colorOf(visual.key);
  const most = Math.max(1, ...[...(plan?.values() ?? [])].map((row) => row.count));
  const columns = plan
    ? "grid-cols-[minmax(0,1fr)_3rem_4.5rem] sm:grid-cols-[10.5rem_minmax(0,1fr)_3rem_4.5rem_6.5rem]"
    : "grid-cols-[minmax(0,1fr)_3rem_4.5rem] sm:grid-cols-[10.5rem_minmax(0,1fr)_3rem_4.5rem]";
  return (
    <div className="mt-3">
      <div aria-hidden="true" className={cn("hidden gap-x-4 border-b border-[var(--border-soft)] pb-1.5 text-xs text-ink-muted sm:grid", columns)}>
        <span>Component</span>
        <span className="flex justify-between tabular-nums">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </span>
        <span className="text-right">Score</span>
        <span className="text-right">vs national</span>
        {plan ? <span className="pl-2">Plan</span> : null}
      </div>
      <ul>
        {visual.components.map((component) => {
          const measured = component.status === "measured" && component.value !== null;
          const row = plan?.get(component.key);
          const gap = measured && component.national !== null ? component.value! - component.national : null;
          const unplanned = row && row.scoreStatus === "below average" && row.count === 0;
          return (
            <li key={component.key} className={cn("grid items-center gap-x-4 gap-y-1.5 border-b border-[var(--border-soft)] py-2.5", columns)}>
              <span className={cn("order-1 text-sm leading-snug", measured ? "text-ink" : "text-ink-muted")}>{component.label}</span>
              <span className="order-4 col-span-3 sm:order-2 sm:col-span-1">
                {measured ? (
                  <ComponentDot value={component.value!} national={component.national} province={component.province} color={color} />
                ) : (
                  <span className="block border-t border-dashed border-[var(--border-strong)] pt-1 text-xs text-ink-muted">
                    {component.status === "not applicable" ? "Not applicable here" : "Not recorded. The score counts a fixed value."}
                  </span>
                )}
              </span>
              <span className="order-2 text-right text-sm tabular-nums text-ink sm:order-3">{measured ? formatValue(component.value!) : "–"}</span>
              <span className="order-3 text-right text-sm sm:order-4">{measured ? <Delta value={gap} /> : null}</span>
              {plan ? (
                <span className="order-5 col-span-3 flex items-center gap-2 text-xs text-ink-muted sm:col-span-1 sm:pl-2">
                  {row && row.count > 0 ? (
                    <>
                      <span className="w-5 text-right tabular-nums text-ink">{row.count}</span>
                      <span aria-hidden="true" className="h-2 rounded-[2px] bg-[var(--ink-muted)] opacity-50" style={{ width: `${(row.count / most) * 2.75}rem` }} />
                      <span className="sm:hidden">in the plan</span>
                    </>
                  ) : (
                    <span className={cn(unplanned ? "font-medium text-delta-below" : "text-ink-muted")}>
                      {unplanned ? "Gap, none" : "None"}
                      <span className="sm:hidden"> in the plan</span>
                    </span>
                  )}
                </span>
              ) : null}
              <span className="sr-only">
                {measured
                  ? `${component.label}: ${formatValue(component.value!)}, national average ${formatScore(component.national, 1)}.`
                  : `${component.label}: not recorded.`}
                {row ? ` The plan makes ${row.count} commitments on it.` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Trend({ visual, unitName }: { visual: PillarVisual; unitName: string }) {
  const comparable = visual.change.direction !== "not comparable";
  const first = visual.history.find((point) => point.value !== null);
  const direction = visual.change.direction;
  const note =
    direction === "not comparable"
      ? `Years don't compare${visual.change.changedComponent ? `: ${visual.change.changedComponent} was not recorded the same way every year` : ""}.`
      : direction === "broadly stable"
        ? `Broadly stable since ${visual.change.baseYear}.`
        : direction === "rose" || direction === "fell"
          ? `${direction === "rose" ? "Up" : "Down"} ${formatScore(Math.abs(visual.change.points ?? 0), 1)} points since ${visual.change.baseYear}.`
          : "Only one year of data.";
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Over time</h3>
      <div className="mt-3">
        <Sparkline points={visual.history} comparable={comparable} color={colorOf(visual.key)} />
      </div>
      <p className="mt-1 flex justify-between text-xs tabular-nums text-ink-muted" aria-hidden="true">
        <span>{first ? `${first.year}: ${formatScore(first.value, 1)}` : null}</span>
        <span>{`${visual.history.at(-1)?.year}: ${formatScore(visual.score, 1)}`}</span>
      </p>
      <p className="mt-2 text-xs leading-5 text-ink-muted">
        <span className="sr-only">{unitName}, {pillarName(visual.label)} score by year. </span>
        {note}
      </p>
    </div>
  );
}

function Similar({ visual, brief }: { visual: PillarVisual; brief: BriefData }) {
  if (visual.neighbours.length === 0) return null;
  const rows = [{ name: brief.unit.name, score: visual.score, self: true }, ...visual.neighbours.map((entry) => ({ ...entry, self: false }))];
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Similar {brief.country.unit.plural.toLowerCase()}</h3>
      <p className="mt-0.5 text-xs text-ink-muted">Closest on measured components, population, and land area</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
            <span className={cn("truncate", row.self ? "font-medium text-ink" : "text-ink")}>{row.name}</span>
            <ScoreBar value={row.score} color={colorOf(visual.key)} emphasis={row.self} />
            <span className="text-right tabular-nums text-ink">{formatScore(row.score, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The plan's commitments on this pillar, one quote per component with the rest behind a disclosure. */
function Commitments({ section }: { section: PlanPillar }) {
  if (section.commitments.length === 0) return null;
  const quote = (item: PlanPillar["commitments"][number]["items"][number]) => (
    <li key={`${item.link}-${item.quote.slice(0, 40)}`} className="print:break-inside-avoid">
      <blockquote className="border-l-2 border-[var(--border-strong)] pl-3 text-sm leading-6 text-ink">{item.quote}</blockquote>
      {item.english ? (
        <p className="mt-0.5 pl-3 text-xs leading-5 text-ink-muted">
          <span className="font-medium">{MACHINE_TRANSLATION_LABEL}:</span> {item.english}
        </p>
      ) : null}
      <a href={item.link} target="_blank" rel="noreferrer" className={cn(LINK, "mt-0.5 ml-3 inline-block text-xs")}>
        Page {item.page}
      </a>
    </li>
  );
  return (
    <div className="mt-10">
      <h3 className="text-sm font-semibold text-ink">What the plan commits to</h3>
      <div className="mt-3 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {section.commitments.map((group) => (
          <div key={group.component}>
            <p className="flex items-baseline justify-between gap-3 border-b border-[var(--border-soft)] pb-1 text-sm font-medium text-ink">
              {group.component}
              <span className="text-xs font-normal tabular-nums text-ink-muted">{group.total === 1 ? "1 commitment" : `${group.total} commitments`}</span>
            </p>
            <ul className="mt-2.5 space-y-3">{group.items.slice(0, 1).map(quote)}</ul>
            {group.items.length > 1 ? (
              <details className="mt-2 print:hidden">
                <summary className={cn(LINK, "cursor-pointer text-xs")}>{group.items.length - 1} more quoted</summary>
                <ul className="mt-2.5 space-y-3">{group.items.slice(1).map(quote)}</ul>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The code-written sentences behind the charts, collapsed on screen and always printed. */
function AsText({ pillar, brief }: { pillar: BriefData["pillars"][number]; brief: BriefData }) {
  const paragraphs = paragraphsOf(pillar.sentences).map((group) => (
    <p key={group[0].kind}>
      <Sentences sentences={group} brief={brief} />
    </p>
  ));
  return (
    <>
      <details className="mt-6 print:hidden">
        <summary className={cn(LINK, "cursor-pointer text-sm")}>Read as text</summary>
        <div className="mt-3 max-w-3xl space-y-3 text-base leading-7 text-ink">{paragraphs}</div>
      </details>
      <div className="mt-6 hidden max-w-3xl space-y-3 text-sm leading-6 text-ink print:block">{paragraphs}</div>
    </>
  );
}

/** Where the plan's part of a score stands, in one line under its chart. */
function planNote(section: PlanPillar, name: string) {
  switch (section.visibility.kind) {
    case "reviewed":
      return `Plan commitments ${lowerFirst(planStatusLine(section) ?? "")}`;
    case "in review":
      return `The plan's commitments on ${name} appear here once they're reviewed.`;
    case "withheld":
      return `The plan's commitments on ${name} are not published.`;
    case "no plan":
      return null;
  }
}

function PillarSection({ visual, brief, section }: { visual: PillarVisual; brief: BriefData; section: PlanPillar | null }) {
  const pillar = brief.pillars.find((entry) => entry.key === visual.key)!;
  const gap = visual.score !== null && visual.national !== null ? visual.score - visual.national : null;
  const planShown = section !== null && (section.visibility.kind === "reviewed" || section.visibility.kind === "no plan");
  const planRows = section && section.visibility.kind === "reviewed" ? new Map(section.coverage.rows.map((row) => [row.key, row])) : null;
  const status = section ? planNote(section, pillarName(visual.label)) : null;
  return (
    <section id={`brief-${visual.key}`} aria-labelledby={`brief-${visual.key}-title`} className="mt-14 scroll-mt-24 border-t border-[var(--border-soft)] pt-6 print:break-before-page">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={`brief-${visual.key}-title`} className="flex items-center gap-2.5 font-heading text-2xl leading-tight font-semibold text-ink">
          <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: colorOf(visual.key) }} />
          {pillarName(visual.label)}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
          <span className="font-heading text-xl font-semibold tabular-nums text-ink">{formatScore(visual.score, 1)}</span>
          {visual.band ? <span>{visual.band}</span> : null}
          <span aria-hidden="true">·</span>
          <span>
            <Delta value={gap} /> vs national
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <h3 className="text-sm font-semibold text-ink">How each component compares</h3>
          <ComponentRows visual={visual} plan={planRows} />
          {planShown && section.coverage.sentences.length > 0 ? (
            <div className="mt-4 space-y-1.5 text-sm leading-6 text-ink">
              {section.coverage.sentences.map((sentence) => (
                <p key={sentence.text}>
                  <Sentences sentences={[sentence]} brief={brief} facts={section.coverage.facts} />
                </p>
              ))}
            </div>
          ) : null}
          {status ? <p className="mt-4 text-sm text-ink-muted">{status}</p> : null}
        </div>
        <aside className="space-y-8">
          <Trend visual={visual} unitName={brief.unit.name} />
          <Similar visual={visual} brief={brief} />
        </aside>
      </div>

      {planShown && section.visibility.kind === "reviewed" ? <Commitments section={section} /> : null}
      <AsText pillar={pillar} brief={brief} />
    </section>
  );
}

/**
 * The planning brief for one unit: the three scores at a glance, then one chart-led section
 * per score with the plan's commitments where they have been reviewed. Section one's
 * sentences stay one click away and in every print and export (decision 13).
 */
export function BriefView({ brief }: { brief: BriefData }) {
  const unitPlural = `${brief.country.name}'s ${brief.country.unit.plural.toLowerCase()}`;
  const sourceNote = planSourceNote(brief);
  const sections = new Map(brief.planSections?.map((section) => [section.pillar, section]) ?? []);

  return (
    <article className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">Planning brief</p>
          <h1 className="mt-1 font-heading text-4xl leading-tight font-semibold text-ink">{brief.unit.name}</h1>
          <p className="mt-1 text-base text-ink-muted">
            {brief.unit.province}, {brief.country.name} · {brief.release.year} data
          </p>
        </div>
        <BriefActions brief={brief} />
      </header>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-muted">
        {briefStatus(brief)}{" "}
        <Link href="/methodology" className={`${LINK} print:no-underline`}>
          How the scores are made
        </Link>
      </p>

      <ScoresAtAGlance brief={brief} />

      {brief.visuals.map((visual) => (
        <PillarSection key={visual.key} visual={visual} brief={brief} section={sections.get(visual.key) ?? null} />
      ))}

      <section aria-labelledby="brief-plans-title" id="brief-plans" className="mt-14 scroll-mt-24 border-t border-[var(--border-soft)] pt-6">
        <h2 id="brief-plans-title" className="font-heading text-xl leading-tight font-semibold text-ink">
          Plan documents
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{planDocumentsNote(brief)}</p>
        {sourceNote ? <p className="mt-2 text-sm leading-6 text-ink-muted">{sourceNote}</p> : null}
        <div className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {brief.plans.unitLabel} plans for {brief.plans.unitName}
            </h3>
            <PlanList documents={brief.plans.local} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">National plans</h3>
            <PlanList documents={brief.plans.national} />
          </div>
        </div>
      </section>

      <footer className="mt-12 space-y-2 border-t border-[var(--border-soft)] pt-6 text-xs leading-5 text-ink-muted">
        <p>{bandNote(unitPlural)}</p>
        <p>{DATA_NOTE}</p>
        <p>{editionLine(brief)}.</p>
      </footer>
    </article>
  );
}
