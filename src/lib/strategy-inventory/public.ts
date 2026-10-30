// What the public inventory page may show. A record's notes hold raw pipeline errors and model-written
// assessments nobody has reviewed, so the page never prints them: it maps each note to one fixed sentence,
// or to nothing.
import type { ReadinessCategory, StrategyInventoryRecord } from "./types.ts";

export const STATUS_LABELS: Record<ReadinessCategory, string> = {
  "AI-ready": "Text read",
  "Found / Not Parsed": "Not yet read",
  "Needs Translation": "Needs translation",
  "Needs Validation": "Needs a check",
  Missing: "No document",
};

export type DocumentIssue = "no-link" | "download-failed" | "no-text" | "regional-unnamed" | "regional" | "not-named" | "unclear";

/** The one problem a note records, or null when the note records none or has a shape this page does not know. */
export function documentIssue(notes: string | null | undefined): DocumentIssue | null {
  const text = notes?.trim() ?? "";
  if (!text) return null;
  if (/^No source URL/i.test(text)) return "no-link";
  if (/^URL request failed|did not return a PDF/i.test(text)) return "download-failed";
  if (/could not be parsed/i.test(text)) return "no-text";

  const flagged = /Needs human validation:([^.]*(?:\.\d+)?)/i.exec(text)?.[1];
  if (!flagged) return null;
  const regional = /document_scope=regional/i.test(flagged);
  const unnamed = /matches_local_unit=no/i.test(flagged);
  if (regional && unnamed) return "regional-unnamed";
  if (regional) return "regional";
  if (unnamed) return "not-named";
  return "unclear";
}

/** The sentence a public card shows for an issue. `unit` is the country's word for one unit, such as "district". */
export function issueSentence(issue: DocumentIssue, unit: string) {
  switch (issue) {
    case "no-link":
      return `The source list has no link for this ${unit}.`;
    case "download-failed":
      return "The link did not return a PDF when it was checked.";
    case "no-text":
      return "The PDF has no text layer on its first pages, so it is probably a scan.";
    case "regional-unnamed":
      return `An automatic check found a regional document that does not name this ${unit}.`;
    case "regional":
      return `An automatic check found a regional document that covers this ${unit} among others.`;
    case "not-named":
      return `An automatic check could not find this ${unit} named in the document.`;
    case "unclear":
      return "An automatic check could not tell whether this is a local development plan.";
  }
}

/** The link without tracking parameters, or null when there is no usable http(s) link. */
export function cleanSourceUrl(url: string | null | undefined) {
  if (!url?.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key)) parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

/** The site a link points at, without "www.", for the label under a document link. */
export function sourceHost(url: string | null | undefined) {
  const clean = cleanSourceUrl(url);
  return clean ? new URL(clean).hostname.replace(/^www\d*\./i, "") : null;
}

/** The years a plan says it covers, falling back to the year it was published. */
export function planPeriod(record: Pick<StrategyInventoryRecord, "valid_from_year" | "valid_to_year" | "publication_year">) {
  const from = record.valid_from_year ?? null;
  const to = record.valid_to_year ?? null;
  if (from !== null && to !== null) return from === to ? String(from) : `${from} to ${to}`;
  if (to !== null) return `Until ${to}`;
  if (record.publication_year != null) return `Published ${record.publication_year}`;
  return "Not recorded";
}

/** Whether a plan's stated period includes the year. A plan with no end year does not count. */
export function coversYear(record: Pick<StrategyInventoryRecord, "valid_from_year" | "valid_to_year" | "publication_year">, year: number) {
  const to = record.valid_to_year ?? null;
  if (to === null || to < year) return false;
  const from = record.valid_from_year ?? record.publication_year ?? null;
  return from === null || from <= year;
}

/** One row of the public table. Built on the server, so a record's notes never reach the browser. */
export type InventoryRow = {
  key: string;
  name: string;
  localName: string | null;
  region: string | null;
  status: ReadinessCategory;
  issue: string | null;
  period: string;
  /** For sorting by period: the last year the plan covers, else the year it was published. */
  sortYear: number | null;
  title: string | null;
  url: string | null;
  host: string | null;
};

export function toInventoryRow(record: StrategyInventoryRecord, status: ReadinessCategory, unit: string): InventoryRow {
  const issue = documentIssue(record.notes);
  const url = cleanSourceUrl(record.source_url);
  return {
    key: `${record.lsg_id}-${record.document_type}`,
    name: record.lsg_name,
    localName: record.lsg_name_local && record.lsg_name_local !== record.lsg_name ? record.lsg_name_local : null,
    region: record.region_name || null,
    status,
    // A passing document needs no note; the others say why they are not read.
    issue: issue && status !== "AI-ready" ? issueSentence(issue, unit) : null,
    period: status === "Missing" ? "" : planPeriod(record),
    sortYear: record.valid_to_year ?? record.publication_year ?? null,
    title: record.document_title?.trim() || null,
    url,
    host: sourceHost(url),
  };
}

export function filterInventoryRows(rows: readonly InventoryRow[], query: string, status: ReadinessCategory | "all") {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      (!needle || [row.name, row.localName, row.region, row.title].some((value) => value?.toLowerCase().includes(needle))),
  );
}

/** Status colors from the theme tokens, so both themes work. A missing document is a gray ring, not a fill. */
export const STATUS_COLORS: Record<ReadinessCategory, string> = {
  "AI-ready": "var(--delta-above)",
  "Found / Not Parsed": "var(--chart-1)",
  "Needs Translation": "var(--chart-5)",
  "Needs Validation": "var(--delta-below)",
  Missing: "color-mix(in srgb, var(--ink-muted) 45%, transparent)",
};
