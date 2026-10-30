import { z } from "zod";

import type { AiStageModelSettings, OpenAiTextFormat } from "../ai/openai-request.ts";
import { SOURCE_DOCUMENT_RULES, wrapSourceDocument } from "../ai/source-documents.ts";
import type { PlanPage } from "./pages.ts";
import { locateQuote, matchKey, type QuoteMatch } from "./quotes.ts";

/**
 * Commitment extraction: the model reads a plan in chunks of pages and quotes each
 * commitment that bears on a score component. Code then finds every quote in the plan's
 * own text and drops the ones it cannot find.
 */

export const EXTRACTION_PROMPT_VERSION = "commitments-v4";
export const PAGES_PER_CHUNK = 25;
export const MAX_COMMITMENTS_PER_CHUNK = 40;

// Low effort: the work is finding and copying text, not weighing it.
export const EXTRACTION_MODEL_SETTINGS: AiStageModelSettings = { effort: "low", temperature: 0, maxOutputTokens: 16_000 };

/**
 * What each component measures, in words a plan would use. The source data's own
 * descriptions for the road and railway risks are swapped, so these are written here;
 * Son's team should review them.
 */
export const COMPONENT_GLOSSES: Record<string, string> = {
  broadband_internet: "fixed broadband speed at schools and hospitals",
  mobile_internet: "mobile network coverage and speed",
  key_structure_internet_access: "connecting schools and hospitals to the internet",
  accessibility_to_hospitals: "health facilities within walking distance: building, upgrading, or reaching clinics and hospitals",
  accessibility_to_schools: "schools within walking distance: building, upgrading, or reaching schools",
  emissions: "total greenhouse gas emissions: energy, transport, industry, waste, and farming emissions",
  air_quality: "fine-particle air pollution (PM2.5): burning, dust, traffic, and industry",
  deforestation: "forest cover: protecting forests, stopping clearing, planting trees",
  emissions_per_area: "greenhouse gas emissions per square kilometre",
  railway_heatwave: "railways exposed to extreme heat",
  road_heatwave: "roads exposed to extreme heat",
  road_flood: "roads exposed to floods: drainage, raising, or protecting roads",
  railway_flood: "railways exposed to floods",
  luminosity_per_capita: "night-time light per person, a sign of electrification and economic activity",
  luminosity_per_area: "night-time light per square kilometre: electrification, street lighting, and economic activity",
  built_area_development: "growth of built-up land: housing, industrial and commercial sites, and urban expansion",
  tourism: "tourism sites, attractions, and facilities",
  agricultural_land: "land in agricultural use: expanding, irrigating, or protecting farmland",
};

export const commitmentOutput = z.object({
  commitments: z.array(
    z.object({
      quote: z.string(),
      page: z.number(),
      english: z.string().nullable(),
      components: z.array(z.string()),
      kind: z.enum(["project", "programme", "target", "budget", "policy"]),
      strength: z.enum(["specific", "general"]),
    }),
  ),
});

export type RawCommitment = z.infer<typeof commitmentOutput>["commitments"][number];

const commitmentSchema = z.toJSONSchema(commitmentOutput, { target: "draft-7" }) as Record<string, unknown>;
delete commitmentSchema.$schema;
export const commitmentFormat: OpenAiTextFormat = { type: "json_schema", name: "plan_commitments", schema: commitmentSchema, strict: true };

export const EXTRACTION_SYSTEM_PROMPT = [
  "You read pages of a government development plan and list its commitments that bear on the score components you are given.",
  "A commitment is something the plan says the government will do, build, fund, or achieve: a project, a programme, a target, a budget line, or a policy. Background, statistics, problems, and descriptions of the current situation are not commitments.",
  "Quote the plan word for word, in its own language, from a single page, and give the number from that page's [page N] marker. Never translate, correct, or join text from two places in the quote. Keep each quote to one to three sentences, or one table row.",
  "Each quote must say on its own what will be done. Skip sentences that only point back to something else, such as \"This will be a priority in 2024\".",
  "Quote one item at a time. Never shorten a quote with \"...\", and never join separate bullet points, list items, or table columns into one quote.",
  "For a table, quote the cells of one row together, in the order they appear in the text. Never quote a single cell or a row of numbers on its own.",
  "If the quote is not in English, put an English translation in english; otherwise set english to null.",
  "List in components only the components the commitment directly changes, by their keys, and usually just one. Leave out commitments that change none.",
  "For example: building or upgrading a clinic is accessibility_to_hospitals, not a luminosity component; planting trees is deforestation, not emissions or air_quality unless the plan says it is for them; power connections and street lights are luminosity; farm inputs and training are agricultural_land only when they add, irrigate, or protect farmland.",
  "Set strength to specific when the commitment names a place, a quantity, a budget, or a date, and to general otherwise.",
  `List at most ${MAX_COMMITMENTS_PER_CHUNK} commitments, preferring specific ones. If the pages hold none, return an empty list.`,
  ...SOURCE_DOCUMENT_RULES,
].join("\n");

export type PlanForExtraction = { id: string; url: string; title: string; country: string; level: "local" | "national"; units: string[] };

/** Pages with readable text, in groups of PAGES_PER_CHUNK. Empty and garbled pages are skipped. */
export function chunkPages(pages: readonly PlanPage[]) {
  const readable = pages.filter((page) => page.quality === "ok");
  const chunks: PlanPage[][] = [];
  for (let index = 0; index < readable.length; index += PAGES_PER_CHUNK) chunks.push(readable.slice(index, index + PAGES_PER_CHUNK));
  return chunks;
}

export function buildExtractionPrompt(plan: PlanForExtraction, chunk: readonly PlanPage[], components: ReadonlyArray<{ key: string; label: string; pillar: string }>) {
  const coverage = plan.level === "national" ? `the national plan of ${plan.country}` : `the local plan for ${plan.units.join(", ")}`;
  return [
    `Plan: ${plan.title}, ${coverage}.`,
    "",
    "Score components (key: what it measures):",
    ...components.map((component) => `- ${component.key} (${component.pillar}): ${COMPONENT_GLOSSES[component.key] ?? component.label}`),
    "",
    wrapSourceDocument({
      kind: plan.level === "national" ? "national_plan" : "local_plan",
      source: plan.url,
      title: plan.title,
      text: chunk.map((page) => `[page ${page.num}]\n${page.text}`).join("\n\n"),
    }),
  ].join("\n");
}

export type VerifiedCommitment = Omit<RawCommitment, "page"> & {
  /** The page the quote is on, which may differ from the one the model gave. */
  page: number;
  citedPage: number;
  match: QuoteMatch["status"];
  similarity: number;
};

export type DroppedCommitment = RawCommitment & { reason: string };

/**
 * Keeps commitments whose quote is in the plan and which name a known component.
 * The same quote from two chunks counts once.
 */
export function verifyCommitments(raw: readonly RawCommitment[], pages: ReadonlyArray<{ num: number; text: string }>, componentKeys: ReadonlySet<string>) {
  const kept: VerifiedCommitment[] = [];
  const dropped: DroppedCommitment[] = [];
  const seen = new Set<string>();
  for (const commitment of raw) {
    const components = [...new Set(commitment.components.filter((key) => componentKeys.has(key)))];
    if (components.length === 0) {
      dropped.push({ ...commitment, reason: "names no known component" });
      continue;
    }
    const match = locateQuote(commitment.quote, pages, commitment.page);
    if (match.status !== "exact" && match.status !== "fuzzy") {
      dropped.push({ ...commitment, reason: `quote ${match.status}` });
      continue;
    }
    const key = matchKey(commitment.quote);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...commitment, components, page: match.page as number, citedPage: commitment.page, match: match.status, similarity: match.similarity });
  }
  return { kept, dropped };
}

export function parseCommitmentOutput(text: string): { ok: true; commitments: RawCommitment[] } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "The response is not JSON." };
  }
  const parsed = commitmentOutput.safeParse(json);
  return parsed.success
    ? { ok: true, commitments: parsed.data.commitments }
    : { ok: false, error: `The response does not match the schema: ${parsed.error.issues[0]?.message ?? "unknown issue"}` };
}
