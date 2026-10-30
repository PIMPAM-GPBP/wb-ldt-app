import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getProvincePlanCandidatesForProvince, loadNationalPlanSources } from "@/lib/ai/documents";
import { PILLARS } from "@/lib/analytics/derive";
import type { BriefData, BriefPlanDocument, PillarVisual, PlanPillar } from "@/lib/brief/document";
import { createFactSheetBuilder, FACT_SHEET_VERSION, type Fact, type FactSheet } from "@/lib/brief/facts";
import { displayQuote, pageLink } from "@/lib/brief/plan-sections";
import { pillarContentHash, pillarPlanView } from "@/lib/brief/plan-view";
import { visibility } from "@/lib/brief/review";
import { renderSectionOne } from "@/lib/brief/section-one";
import { loadUnitPlanData } from "@/lib/brief/store";
import type { Country } from "@/lib/countries";
import type { AnalyticsDataset } from "@/types/analytics";

// Fact sheets come from the generated analytics files, which hold the same values as
// Supabase (scripts/check-brief-data.mjs checks every one). Reading them saves about
// 165,000 Supabase rows per country each time a server starts.
const builders = new Map<string, Promise<ReturnType<typeof createFactSheetBuilder>>>();

function builderFor(country: Country) {
  const cached = builders.get(country.code);
  if (cached) return cached;
  const builder = readFile(path.join(process.cwd(), country.fallbackDataPath), "utf8").then((raw) =>
    createFactSheetBuilder(JSON.parse(raw) as AnalyticsDataset, country),
  );
  builders.set(country.code, builder);
  builder.catch(() => builders.delete(country.code));
  return builder;
}

/** Every unit of the country's release, for the review console. */
export async function listUnits(country: Country) {
  return (await builderFor(country)).units();
}

/** The release the country's fact sheets describe. */
export async function getRelease(country: Country) {
  return (await builderFor(country)).release;
}

export async function getFactSheet(country: Country, compositeKey: string) {
  return (await builderFor(country)).sheetFor(compositeKey);
}

function uniqueByLink(documents: BriefPlanDocument[]) {
  return [...new Map(documents.map((document) => [document.link, document])).values()];
}

async function planDocuments(country: Country, unit: BriefData["unit"]): Promise<BriefData["plans"]> {
  const fromUnit = country.planningDocuments.planSourceAdminLevel === "lower";
  const unitName = fromUnit ? unit.name : unit.province;
  const [local, national] = await Promise.all([
    getProvincePlanCandidatesForProvince(country.code, unitName).catch((error) => {
      console.error(`Unable to load ${country.code} local plans for ${unitName}:`, error);
      return [];
    }),
    // Throws when the country has no national rows; the brief then lists none.
    loadNationalPlanSources(country.code).catch(() => []),
  ]);
  const toDocument = (source: { title: string; link: string; documentType: string | null }) => ({
    title: source.title,
    link: source.link,
    // Stored as codes such as "development_plan".
    documentType: source.documentType?.replaceAll("_", " ") ?? null,
  });
  return {
    source: fromUnit ? "unit" : "higher unit",
    unitLabel: fromUnit ? country.adminLabels.lower.singular : country.adminLabels.higher.singular,
    unitName,
    local: uniqueByLink(local.map(toDocument)),
    national: uniqueByLink(national.map(toDocument)),
  };
}

/** Commitments shown per component in the brief; the review console shows them all. */
const ITEMS_PER_COMPONENT = 4;
const componentName = (label: string) => label.replace(/ Score$/, "");

/**
 * Sections two and three per pillar, holding only what the public may see: reviewed sections,
 * and a status line for the rest.
 */
async function planSectionsFor(country: Country, sheet: FactSheet, order: string[]): Promise<PlanPillar[] | null> {
  const data = await loadUnitPlanData(country, sheet.release.key, sheet.unit);
  if (!data.available) return null;
  const hasPlan = data.plans.length > 0;
  const labels = new Map(sheet.pillars.flatMap((pillar) => pillar.components.map((component) => [component.key, componentName(component.label)])));

  return [...sheet.pillars]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((pillar): PlanPillar => {
      const seen = hasPlan ? visibility(data.reviews.get(pillar.key) ?? null, pillarContentHash(sheet, pillar.key, data.commitments)) : ({ kind: "no plan" } as const);
      const empty = { pillar: pillar.key, label: pillar.label, visibility: seen, commitments: [], coverage: { rows: [], sentences: [], facts: {} } };
      if (seen.kind === "in review" || seen.kind === "withheld") return empty;

      const view = pillarPlanView(sheet, pillar.key, data.commitments, "reviewed", hasPlan);
      const cited = new Set(view.sentences.flatMap((sentence) => sentence.factIds));
      return {
        ...empty,
        commitments: view.rows
          .filter((row) => row.commitments.length > 0)
          .map((row) => ({
            component: labels.get(row.component.key) ?? row.component.key,
            total: row.commitments.length,
            items: [...row.commitments]
              .sort((a, b) => (a.strength === b.strength ? a.page - b.page : a.strength === "specific" ? -1 : 1))
              .slice(0, ITEMS_PER_COMPONENT)
              .map((commitment) => ({ quote: displayQuote(commitment.quote), english: commitment.english, page: commitment.page, link: pageLink(commitment), kind: commitment.kind, strength: commitment.strength })),
          })),
        coverage: {
          rows: view.rows.map((row) => ({ key: row.component.key, component: labels.get(row.component.key) ?? row.component.key, scoreStatus: row.scoreStatus, salience: row.salience, count: row.commitments.length })),
          sentences: view.sentences,
          facts: Object.fromEntries([...cited].map((id) => [id, view.sheet.facts[id]])),
        },
      };
    });
}

const NEIGHBOURS = 3;

/** One pillar's chart numbers, read from the full sheet so the charts and the sentences share their facts. */
function pillarVisual(sheet: FactSheet, pillar: FactSheet["pillars"][number], distribution: number[]): PillarVisual {
  const value = (id: string) => sheet.facts[`${pillar.key}.${id}`]?.value ?? null;
  const number = (id: string) => {
    const fact = value(id);
    return typeof fact === "number" ? fact : null;
  };
  const text = (id: string) => {
    const fact = value(id);
    return typeof fact === "string" ? fact : null;
  };
  const years = Array.from({ length: sheet.release.year - sheet.release.firstYear + 1 }, (_, index) => sheet.release.firstYear + index);
  const changed = text("change.coverage_changed.1");
  return {
    key: pillar.key,
    label: pillar.label,
    score: number("score"),
    national: number("national_average"),
    province: number("province_average"),
    band: text("band.national"),
    distribution,
    history: years.map((year) => ({ year, value: year === sheet.release.year ? number("score") : number(`score.${year}`) })),
    change: {
      direction: text("change.direction"),
      points: number("change.points"),
      baseYear: number("change.base_year"),
      changedComponent: changed ? (pillar.components.find((component) => component.key === changed)?.label.replace(/ Score$/, "") ?? changed) : null,
    },
    components: pillar.components.map((component) => ({
      key: component.key,
      label: component.label.replace(/ Score$/, ""),
      value: number(`component.${component.key}.value`),
      national: number(`component.${component.key}.national_average`),
      province: number(`component.${component.key}.province_average`),
      status: text(`component.${component.key}.status`) ?? "missing",
    })),
    neighbours: Array.from({ length: NEIGHBOURS }, (_, index) => ({ name: text(`neighbour.${index + 1}.name`), score: number(`neighbour.${index + 1}.score`) }))
      .filter((entry): entry is { name: string; score: number | null } => entry.name !== null),
  };
}

/** The brief for one unit, or null if the release has no record for it. */
export async function getBriefData(country: Country, compositeKey: string): Promise<BriefData | null> {
  const builder = await builderFor(country);
  const sheet = builder.sheetFor(compositeKey);
  if (!sheet) return null;

  const order = PILLARS.map((pillar) => pillar.id);
  const pillars = [...sheet.pillars]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((pillar) => ({ key: pillar.key, label: pillar.label, sentences: renderSectionOne(sheet, pillar.key) }));
  const cited = new Set(pillars.flatMap((pillar) => pillar.sentences.flatMap((sentence) => sentence.factIds)));
  const facts: Record<string, Fact> = Object.fromEntries([...cited].map((id) => [id, sheet.facts[id]]));
  const visuals = [...sheet.pillars]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((pillar) => pillarVisual(sheet, pillar, builder.scores(pillar.scoreId)));
  const unitCount = sheet.facts["country.unit_count"]?.value;

  return {
    factSheetVersion: FACT_SHEET_VERSION,
    sheetId: sheet.id,
    country: sheet.country,
    release: sheet.release,
    unit: sheet.unit,
    pillars,
    visuals,
    unitCount: typeof unitCount === "number" ? unitCount : visuals[0]?.distribution.length ?? 0,
    facts,
    plans: await planDocuments(country, sheet.unit),
    planSections: await planSectionsFor(country, sheet, order),
  };
}
