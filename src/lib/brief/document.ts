import type { Pillar } from "@/types/analytics";

import type { Fact, FactSheet } from "./facts.ts";
import type { Visibility } from "./review.ts";
import type { BriefSentence, SentenceKind } from "./section-one.ts";

/**
 * The planning brief as served: its fixed text, its data, and its Markdown export.
 * The page and the export share this text, so a copy that leaves the site keeps
 * the status line and the band note.
 */

export type BriefPlanDocument = { title: string; link: string; documentType: string | null };

export type PlanSectionItem = { quote: string; english: string | null; page: number; link: string; kind: string; strength: string };

/** Sections two and three for one pillar, as the reader may see them. */
export type PlanPillar = {
  pillar: Pillar;
  label: string;
  visibility: Visibility | { kind: "no plan" };
  /** Empty unless the reader may see the sections. */
  commitments: Array<{ component: string; items: PlanSectionItem[]; total: number }>;
  coverage: { rows: Array<{ key: string; component: string; scoreStatus: string; salience: string; count: number }>; sentences: BriefSentence[]; facts: Record<string, Fact> };
};

/** One pillar's numbers as the brief's charts draw them, read from the full fact sheet. */
export type PillarVisual = {
  key: Pillar;
  label: string;
  score: number | null;
  national: number | null;
  province: number | null;
  /** "Second fifth", from the map legend's classes. */
  band: string | null;
  /** Every unit's score in the release year. */
  distribution: number[];
  history: Array<{ year: number; value: number | null }>;
  change: { direction: string | null; points: number | null; baseYear: number | null; changedComponent: string | null };
  components: Array<{ key: string; label: string; value: number | null; national: number | null; province: number | null; status: string }>;
  neighbours: Array<{ name: string; score: number | null }>;
};

export type BriefData = {
  factSheetVersion: number;
  /** Prefix of the sheet's global fact ids. */
  sheetId: string;
  country: FactSheet["country"];
  release: FactSheet["release"];
  unit: FactSheet["unit"];
  pillars: Array<{ key: Pillar; label: string; sentences: BriefSentence[] }>;
  /** The same pillars, as numbers for the charts. */
  visuals: PillarVisual[];
  /** Units in the release with scores and a boundary. */
  unitCount: number;
  /** Only the facts the sentences cite. */
  facts: Record<string, Fact>;
  plans: {
    /** Where the country's local plans come from: the unit itself, or its higher unit. */
    source: "unit" | "higher unit";
    unitLabel: string;
    unitName: string;
    local: BriefPlanDocument[];
    national: BriefPlanDocument[];
  };
  /** Sections two and three per pillar; null where the plan store is not available. */
  planSections: PlanPillar[] | null;
};

export const BRIEF_STATUS = "Written by code from the data. This brief contains no AI-generated text.";

/** What the reader is told about how the brief they are looking at was made. */
export function briefStatus(brief: Pick<BriefData, "planSections">) {
  const reviewed = brief.planSections?.some((section) => section.visibility.kind === "reviewed") ?? false;
  if (!reviewed) return BRIEF_STATUS;
  return "Section one is written by code from the data. Sections two and three quote the local plan; a model picked the quotes, and a reviewer checked them.";
}

export const PLAN_SECTION_TITLES = { commitments: "What the plan commits to", coverage: "Coverage gaps" } as const;

/** Every quote not in English carries this label (decision 10). */
export const MACHINE_TRANSLATION_LABEL = "Machine translation";

/** How a pillar's plan sections stand, in one line; null when the sections themselves are shown without a caveat. */
export function planStatusLine(section: PlanPillar) {
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  switch (section.visibility.kind) {
    case "reviewed":
      return `Reviewed on ${date(section.visibility.reviewedAt)}.`;
    case "in review":
      return "In review. This section appears once a reviewer has checked it.";
    case "withheld":
      return "Not published.";
    case "no plan":
      return null;
  }
}

export const SECTION_ONE_TITLE = "Position and drivers";

export function bandNote(unitPlural: string) {
  return `The brief places each unit in a fifth of ${unitPlural} rather than giving a rank, because nearby ranks often differ by a fraction of a point.`;
}

export const DATA_NOTE =
  "Scores are estimates from satellite and open data. Where a component has nothing recorded, the score still counts a fixed value for it, and the brief says where that applies.";

export function editionLine(brief: Pick<BriefData, "release" | "factSheetVersion">) {
  return `Data edition ${brief.release.year} (${brief.release.key}), fact sheet version ${brief.factSheetVersion}`;
}

export function planSourceNote(brief: Pick<BriefData, "plans" | "unit" | "country">) {
  if (brief.plans.source === "unit") return null;
  const unitSingular = brief.country.unit.singular.toLowerCase();
  return `Local plans in ${brief.country.name} come from the ${brief.plans.unitLabel.toLowerCase()}, so every ${unitSingular} in ${brief.plans.unitName} shares them.`;
}

/** What the plan list is for: the source of the quotes once the plan store is in use, otherwise a reference list. */
export function planDocumentsNote(brief: Pick<BriefData, "planSections">) {
  return brief.planSections ? "The quotes in this brief come from the local plan. The national plan is listed for reference." : "Listed for reference.";
}

/** Paragraphs of section one: position, band, and change first, then drivers, coverage, and neighbours. */
export const PARAGRAPHS: ReadonlyArray<ReadonlyArray<SentenceKind>> = [["position", "band", "change"], ["drivers"], ["coverage"], ["neighbours"]];

export function paragraphsOf(sentences: readonly BriefSentence[]) {
  return PARAGRAPHS.map((kinds) => sentences.filter((sentence) => kinds.includes(sentence.kind))).filter((group) => group.length > 0);
}

function documentLines(documents: readonly BriefPlanDocument[]) {
  return documents.length > 0 ? documents.map((document) => `- [${document.title}](${document.link})`) : ["- None listed."];
}

export function briefTitle(brief: Pick<BriefData, "unit" | "country">) {
  return `Planning brief: ${brief.unit.name}, ${brief.unit.province}, ${brief.country.name}`;
}

/** Sections two and three, for pillars the reader may see; other pillars get their one-line status. */
function planSectionsMarkdown(brief: BriefData) {
  if (!brief.planSections) return [];
  const lines: string[] = [];
  for (const [title, part] of [[PLAN_SECTION_TITLES.commitments, "commitments"], [PLAN_SECTION_TITLES.coverage, "coverage"]] as const) {
    lines.push(`## ${title}`);
    for (const section of brief.planSections) {
      lines.push("", `### ${section.label}`);
      const status = planStatusLine(section);
      if (status) lines.push("", status);
      const shown = section.visibility.kind === "reviewed" || section.visibility.kind === "no plan";
      if (!shown) continue;
      if (part === "commitments") {
        if (section.commitments.length === 0) lines.push("", section.visibility.kind === "no plan" ? "No local plan with readable text is loaded." : "No commitment on this score's components.");
        for (const group of section.commitments) {
          lines.push("", `${group.component}:`);
          for (const item of group.items) {
            lines.push(`- "${item.quote}" ([page ${item.page}](${item.link}))${item.english ? ` ${MACHINE_TRANSLATION_LABEL}: ${item.english}` : ""}`);
          }
          if (group.total > group.items.length) lines.push(`- And ${group.total - group.items.length} more.`);
        }
      } else {
        lines.push("", ...section.coverage.sentences.map((sentence) => `- ${sentence.text}`));
      }
    }
    lines.push("");
  }
  return lines;
}

export function buildBriefMarkdown(brief: BriefData, pageUrl?: string) {
  const unitPlural = `${brief.country.name}'s ${brief.country.unit.plural.toLowerCase()}`;
  const sourceNote = planSourceNote(brief);
  return [
    `# ${briefTitle(brief)}`,
    "",
    briefStatus(brief),
    "",
    `${editionLine(brief)}.${pageUrl ? ` Source: ${pageUrl}` : ""}`,
    "",
    `## ${SECTION_ONE_TITLE}`,
    ...brief.pillars.flatMap((pillar) => ["", `### ${pillar.label}`, ...paragraphsOf(pillar.sentences).flatMap((group) => ["", group.map((sentence) => sentence.text).join(" ")])]),
    "",
    ...planSectionsMarkdown(brief),
    "## Plan documents",
    "",
    planDocumentsNote(brief),
    ...(sourceNote ? ["", sourceNote] : []),
    "",
    `### ${brief.plans.unitLabel} plans for ${brief.plans.unitName}`,
    "",
    ...documentLines(brief.plans.local),
    "",
    "### National plans",
    "",
    ...documentLines(brief.plans.national),
    "",
    "---",
    "",
    bandNote(unitPlural),
    "",
    DATA_NOTE,
    "",
  ].join("\n");
}
