// Turns a stage's source references into numbered notes and rewrites the inline
// "[Sources: ...]" markers the prompts ask for into note numbers.
// Pure functions with no React, so the matching rules can be tested on their own.
import type { AiStageName, AiStageSourceReference } from "@/lib/ai/types";

export type CitationKind = "plan" | "web" | "data" | "step";

export type CitationNote = {
  /** 1-based, unique within one stage result. */
  number: number;
  /** Never empty and at most 140 characters. */
  title: string;
  /** The untruncated title, for accessible names. */
  fullTitle: string;
  kind: CitationKind;
  /** Only http and https sources become links. */
  href: string | null;
  host: string | null;
  /** Plan documents only. */
  role: "local" | "national" | null;
  /** 1-based positions among the web references, matching "Hit N" in web context output. */
  webIndexes: number[];
  /** Steps only: the stage this note points back to. */
  stage: AiStageName | null;
  /** The publication date for web pages, as YYYY-MM-DD. */
  published: string | null;
};

export type CitationSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; numbers: number[]; unresolved: string[] };

const MAX_TITLE_LENGTH = 140;

const STAGES: readonly AiStageName[] = [
  "indicator_narrative",
  "province_plan_context",
  "national_plan_context",
  "web_context_search",
  "plan_alignment",
  "swot_analysis",
  "investment_recommendations",
];

export function safeHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function collapse(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string) {
  return value.length > MAX_TITLE_LENGTH ? `${value.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : value;
}

function hostOf(url: URL | null) {
  return url ? url.hostname.replace(/^www\./, "") : null;
}

function kindOf(type: AiStageSourceReference["type"]): CitationKind {
  if (type === "document") return "plan";
  if (type === "web_search") return "web";
  if (type === "indicator_series") return "data";
  return "step";
}

function publishedOf(reference: AiStageSourceReference) {
  const value = reference.metadata?.publishedDate;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * The pipeline always lists the local plan before the national plan, but label wording varies
 * by country, so text signals decide first and position only breaks a tie.
 */
function documentRoles(stage: AiStageName, documents: AiStageSourceReference[]) {
  if (stage === "province_plan_context") return documents.map(() => "local" as const);
  if (stage === "national_plan_context") return documents.map(() => "national" as const);

  const textNational = documents.map(
    (document) => /national/i.test(document.label) || /\/national\//i.test(document.source),
  );
  if (documents.length === 2 && textNational[0] === textNational[1]) {
    return ["local" as const, "national" as const];
  }
  return textNational.map((isNational) => (isNational ? ("national" as const) : ("local" as const)));
}

export function buildCitationNotes(
  stage: AiStageName,
  references: readonly AiStageSourceReference[] | null | undefined,
): CitationNote[] {
  const list = Array.isArray(references) ? references : [];
  const roles = documentRoles(
    stage,
    list.filter((reference) => reference.type === "document"),
  );

  const notes: CitationNote[] = [];
  const noteByKey = new Map<string, CitationNote>();
  let webCount = 0;
  let documentCount = 0;

  for (const reference of list) {
    const kind = kindOf(reference.type);
    const url = safeHttpUrl(reference.source);
    const webIndex = kind === "web" ? (webCount += 1) : null;
    const role = kind === "plan" ? roles[documentCount++] : null;
    const fullTitle =
      collapse(reference.label) || hostOf(url) || (kind === "web" ? "Untitled web page" : "Untitled source");
    const key = `${kind}|${url?.href ?? collapse(reference.source)}|${fullTitle.toLowerCase()}`;

    const existing = noteByKey.get(key);
    if (existing) {
      // A duplicate keeps its first number, and its own "Hit N" still resolves to that note.
      if (webIndex !== null) existing.webIndexes.push(webIndex);
      continue;
    }

    const source = collapse(reference.source);
    const note: CitationNote = {
      number: notes.length + 1,
      title: truncate(fullTitle),
      fullTitle,
      kind,
      href: url?.href ?? null,
      host: hostOf(url),
      role,
      webIndexes: webIndex === null ? [] : [webIndex],
      stage: kind === "step" ? (STAGES.find((name) => name === source) ?? null) : null,
      published: publishedOf(reference),
    };
    notes.push(note);
    noteByKey.set(key, note);
  }

  return notes;
}

function normalizeLabel(label: string) {
  return collapse(label)
    .toLowerCase()
    .replace(/\b(optional|external|additional)\b/g, "")
    .replace(/[.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numbersOf(notes: readonly CitationNote[], keep: (note: CitationNote) => boolean) {
  return notes.filter(keep).map((note) => note.number);
}

export function resolveCitationLabel(label: string, notes: readonly CitationNote[]): number[] {
  const normalized = normalizeLabel(label);
  if (!normalized) return [];

  const hit = normalized.match(/^hits?\s*#?\s*(\d+)$/);
  if (hit) {
    const index = Number(hit[1]);
    return numbersOf(notes, (note) => note.webIndexes.includes(index));
  }

  const exact = numbersOf(
    notes,
    (note) => note.fullTitle.toLowerCase() === normalized || normalizeLabel(note.fullTitle) === normalized,
  );
  if (exact.length > 0) return exact;

  if (/\b(web|search|news|online)\b/.test(normalized)) {
    return numbersOf(notes, (note) => note.kind === "web");
  }

  const stageRules: Array<[RegExp, AiStageName]> = [
    [/narrative|score analysis|component/, "indicator_narrative"],
    [/alignment/, "plan_alignment"],
    [/swot/, "swot_analysis"],
  ];
  for (const [pattern, stage] of stageRules) {
    if (pattern.test(normalized)) return numbersOf(notes, (note) => note.stage === stage);
  }

  // Later stages cite the plans and the data they were built from, but their own references only
  // list the earlier steps. Point those labels at the step that read them rather than dropping them.
  const orStep = (found: number[], stage: AiStageName) =>
    found.length > 0 ? found : numbersOf(notes, (note) => note.stage === stage);

  if (/\b(data|indicators?|scores?|statistics|series|ldt)\b/.test(normalized)) {
    return orStep(
      numbersOf(notes, (note) => note.kind === "data"),
      "indicator_narrative",
    );
  }
  if (/national/.test(normalized)) {
    return orStep(
      numbersOf(notes, (note) => note.role === "national"),
      "plan_alignment",
    );
  }
  const mentionsPlan = /\b(plan|plans|document|strategy|report)\b/.test(normalized);
  const mentionsLocal = /(provincial|province|local|subnational|district|municipal|council|city)/.test(normalized);
  if (/\bsng\b/.test(normalized) || (mentionsPlan && mentionsLocal)) {
    return orStep(
      numbersOf(notes, (note) => note.role === "local"),
      "plan_alignment",
    );
  }

  return [];
}

export type CitationRun = { from: number; to: number };

/**
 * Groups ascending note numbers into runs. Three or more in a row become one range ("4-8"),
 * so a claim that cites every web page does not print a string of numbers.
 */
export function citationRuns(numbers: readonly number[]): CitationRun[] {
  const runs: CitationRun[] = [];
  let index = 0;
  while (index < numbers.length) {
    let end = index;
    while (end + 1 < numbers.length && numbers[end + 1] === numbers[end] + 1) end += 1;
    if (end - index >= 2) {
      runs.push({ from: numbers[index], to: numbers[end] });
    } else {
      for (let position = index; position <= end; position += 1) {
        runs.push({ from: numbers[position], to: numbers[position] });
      }
    }
    index = end + 1;
  }
  return runs;
}

const MARKER = /\s*\[\s*(?:sources?|citations?)\s*:\s*([^\]]*)\]/gi;

/**
 * Splits text around its "[Sources: A; B]" markers. Labels that match no note stay in
 * `unresolved`, so the reader still sees what the model said it cited.
 */
export function splitCitations(text: string, notes: readonly CitationNote[]): CitationSegment[] {
  const segments: CitationSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: "text", text: text.slice(cursor, start) });
    cursor = start + match[0].length;

    const numbers = new Set<number>();
    const unresolved: string[] = [];
    for (const label of match[1].split(";").map(collapse).filter(Boolean)) {
      const resolved = resolveCitationLabel(label, notes);
      if (resolved.length === 0) unresolved.push(label);
      for (const number of resolved) numbers.add(number);
    }
    if (numbers.size > 0 || unresolved.length > 0) {
      segments.push({ kind: "cite", numbers: [...numbers].sort((a, b) => a - b), unresolved });
    }
  }

  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}
