import { z } from "zod";

import type { AiStageModelSettings, OpenAiTextFormat } from "../ai/openai-request.ts";
import type { Fact, FactSheet } from "./facts.ts";
import { renderSectionOne } from "./section-one.ts";

/**
 * The model's part of section one: connective prose over the templated core,
 * returned as sentences that each list the fact ids they rest on.
 *
 * Not served. On the golden set the draft mostly rephrased the code-only text, so
 * Son decided on 30 October 2026 that section one stays code-only. This stays as the
 * evidence for that decision and the pattern for the sections the model does write.
 */

export const SECTION_ONE_PROMPT_VERSION = "section-one-v2";

// Low effort: the facts are computed, so the model only phrases them.
export const SECTION_ONE_MODEL_SETTINGS: AiStageModelSettings = { effort: "low", temperature: 0, maxOutputTokens: 4_000 };

export const MIN_SENTENCES = 3;
// The core runs to nine sentences for some units, so the model may keep up to eight.
export const MAX_SENTENCES = 8;

export const sectionOneOutput = z.object({
  sentences: z.array(z.object({ text: z.string(), fact_ids: z.array(z.string()) })),
});

export type SectionOneOutput = z.infer<typeof sectionOneOutput>;

// Strict mode needs every property required and no extras, which zod emits;
// the sentence count is checked after parsing, since not every schema keyword is accepted.
const sectionOneSchema = z.toJSONSchema(sectionOneOutput, { target: "draft-7" }) as Record<string, unknown>;
delete sectionOneSchema.$schema;

export const sectionOneFormat: OpenAiTextFormat = { type: "json_schema", name: "section_one", schema: sectionOneSchema, strict: true };

export const SECTION_ONE_SYSTEM_PROMPT = [
  "You write the first section, position and drivers, of a planning brief about one local government unit and one score.",
  "Use only the facts you are given. Each fact has an id, a value, and a description.",
  `Return ${MIN_SENTENCES} to ${MAX_SENTENCES} sentences of plain English for a planner. In each sentence, list in fact_ids the id of every fact the sentence uses.`,
  "Write numbers as digits, as given or rounded to fewer decimals. Give a gap or change as a size with a direction word, such as \"4.2 points below\", never with a minus sign.",
  "Every number must be a fact you cite. Never state a count or a difference you worked out yourself, such as \"these 2 components\"; a component's distance from an average is its gap fact.",
  "Name bands as given, such as \"fourth fifth\". Never state or imply a rank or a position number.",
  "Describe change only from the change facts. If the direction is \"not comparable\" or \"no earlier year\", say the change cannot be stated and why; never describe a trend from yearly values.",
  "A component whose status is \"not recorded\" or \"not applicable\" holds a fixed value. Never compare it, or call it a strength or a weakness; you may say it was not recorded.",
  "Words such as most, largest, or lowest need a driver, band, or neighbour fact.",
  "No causes, no recommendations, no reasons why, and nothing you know about the place from elsewhere.",
  "The core sentences are already checked. You may join and rephrase them for flow, but every claim must still cite its facts.",
].join("\n");

const isHistory = (id: string) => /\.\d{4}$/.test(id);

function factLine(fact: Fact) {
  const value =
    typeof fact.value === "number" ? fact.value.toFixed(fact.decimals ?? 1).replace(/\.0+$/, "") : fact.value === null ? "none" : fact.value;
  return `${fact.id} | ${value} | ${fact.label}`;
}

/** The facts a section one prompt may use: the pillar's own, plus the edition and unit count. */
export function sectionOneFacts(sheet: FactSheet, pillarKey: string) {
  return Object.values(sheet.facts).filter(
    (fact) => (fact.id.startsWith(`${pillarKey}.`) || fact.id.startsWith("release.") || fact.id.startsWith("country.")) && !isHistory(fact.id) && fact.value !== null,
  );
}

export function buildSectionOnePrompt(sheet: FactSheet, pillarKey: FactSheet["pillars"][number]["key"]) {
  const pillar = sheet.pillars.find((entry) => entry.key === pillarKey);
  const core = renderSectionOne(sheet, pillarKey);
  return [
    `Unit: ${sheet.unit.name}, ${sheet.unit.district} district, ${sheet.unit.province}, ${sheet.country.name}`,
    `Unit type: ${sheet.country.unit.singular.toLowerCase()}; higher unit: ${sheet.country.higherUnit.singular.toLowerCase()}`,
    `Score: ${pillar?.label ?? pillarKey}`,
    "",
    "Core sentences, with the facts each one uses:",
    ...core.map((sentence) => `- ${sentence.text} [${sentence.factIds.join(", ")}]`),
    "",
    "Facts (id | value | description):",
    ...sectionOneFacts(sheet, pillarKey).map(factLine),
  ].join("\n");
}

export type ParsedSectionOne =
  | { ok: true; sentences: Array<{ text: string; factIds: string[] }> }
  | { ok: false; error: string };

export function parseSectionOneOutput(text: string): ParsedSectionOne {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "The response is not JSON." };
  }
  const parsed = sectionOneOutput.safeParse(json);
  if (!parsed.success) return { ok: false, error: `The response does not match the schema: ${parsed.error.issues[0]?.message ?? "unknown issue"}` };
  const count = parsed.data.sentences.length;
  if (count < MIN_SENTENCES || count > MAX_SENTENCES) {
    return { ok: false, error: `The response has ${count} sentences, outside ${MIN_SENTENCES} to ${MAX_SENTENCES}.` };
  }
  return { ok: true, sentences: parsed.data.sentences.map((sentence) => ({ text: sentence.text.trim(), factIds: sentence.fact_ids })) };
}
