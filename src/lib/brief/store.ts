import "server-only";

import type { Pillar } from "@/types/analytics";

import type { CommitmentDecision, StoredCommitment, UnitReview } from "@/lib/brief/review";
import { getBriefStore } from "@/lib/brief/supabase";
import type { Country } from "@/lib/countries";

/** Reads and writes for the plan store and its review. */

export type StoredPlan = { id: string; url: string; title: string; units: string[]; script: string | null; status: string };

export type UnitPlanData =
  | { available: false }
  | { available: true; plans: StoredPlan[]; commitments: StoredCommitment[]; reviews: Map<Pillar, UnitReview> };

const IDS_PER_REQUEST = 150;

/** Plan names come from the workbook, so units match on letters and digits alone, as in Phase 3a. */
export const normalizeName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function isMissingTable(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** Local plans with readable text for a unit: its own plans, or its province's where plans come from provinces. */
async function plansFor(country: Country, unit: { name: string; province: string }) {
  const store = getBriefStore();
  if (!store) return null;
  const { data, error } = await store
    .from("brief_plan_documents")
    .select("id, url, title, units, script, status")
    .eq("country_code", country.code)
    .eq("level", "local")
    .eq("status", "text");
  if (isMissingTable(error)) return null;
  if (error) throw error;
  const wanted = normalizeName(country.planningDocuments.planSourceAdminLevel === "lower" ? unit.name : unit.province);
  return (data as StoredPlan[]).filter((plan) => plan.units.some((name) => normalizeName(name) === wanted));
}

async function inChunks<T>(ids: readonly string[], load: (chunk: string[]) => Promise<T[]>) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += IDS_PER_REQUEST) rows.push(...(await load(ids.slice(index, index + IDS_PER_REQUEST))));
  return rows;
}

type CommitmentRow = {
  id: string;
  document_id: string;
  quote: string;
  page: number;
  cited_page: number;
  english: string | null;
  components: string[];
  kind: StoredCommitment["kind"];
  strength: StoredCommitment["strength"];
  match: StoredCommitment["match"];
  similarity: number;
  brief_extraction_runs: { created_at: string } | null;
};

export async function loadUnitPlanData(country: Country, releaseKey: string, unit: { key: string; name: string; province: string }): Promise<UnitPlanData> {
  const store = getBriefStore();
  const plans = await plansFor(country, unit);
  if (!store || plans === null) return { available: false };

  const commitmentRows = await inChunks(
    plans.map((plan) => plan.id),
    async (chunk) => {
      const { data, error } = await store
        .from("brief_commitments")
        .select("id, document_id, quote, page, cited_page, english, components, kind, strength, match, similarity, brief_extraction_runs(created_at)")
        .in("document_id", chunk);
      if (error) throw error;
      return data as unknown as CommitmentRow[];
    },
  );

  // A plan read twice keeps only its latest run.
  const latestRun = new Map<string, string>();
  for (const row of commitmentRows) {
    const created = row.brief_extraction_runs?.created_at ?? "";
    if (created > (latestRun.get(row.document_id) ?? "")) latestRun.set(row.document_id, created);
  }
  const current = commitmentRows.filter((row) => (row.brief_extraction_runs?.created_at ?? "") === latestRun.get(row.document_id));

  const reviewRows = await inChunks(
    current.map((row) => row.id),
    async (chunk) => {
      const { data, error } = await store.from("brief_commitment_reviews").select("commitment_id, decision, components, reviewed_at").in("commitment_id", chunk);
      if (error) throw error;
      return data as Array<{ commitment_id: string; decision: CommitmentDecision["decision"]; components: string[] | null; reviewed_at: string }>;
    },
  );
  const decisions = new Map(reviewRows.map((row) => [row.commitment_id, { decision: row.decision, components: row.components, reviewedAt: row.reviewed_at }]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const commitments: StoredCommitment[] = current
    .map((row) => ({
      id: row.id,
      quote: row.quote,
      page: row.page,
      citedPage: row.cited_page,
      english: row.english,
      components: row.components,
      kind: row.kind,
      strength: row.strength,
      match: row.match,
      similarity: Number(row.similarity),
      planId: row.document_id,
      planUrl: planById.get(row.document_id)?.url ?? "",
      planTitle: planById.get(row.document_id)?.title ?? "",
      review: decisions.get(row.id) ?? null,
    }))
    .sort((a, b) => a.planId.localeCompare(b.planId) || a.page - b.page);

  const { data: unitRows, error } = await store
    .from("brief_unit_reviews")
    .select("pillar, status, reviewed_at, content_hash, note")
    .eq("country_code", country.code)
    .eq("release_key", releaseKey)
    .eq("unit_key", unit.key);
  if (error) throw error;
  const reviews = new Map<Pillar, UnitReview>(
    (unitRows ?? []).map((row) => [row.pillar as Pillar, { status: row.status, reviewedAt: row.reviewed_at, contentHash: row.content_hash, note: row.note }]),
  );

  return { available: true, plans, commitments, reviews };
}

export async function saveCommitmentDecision(input: { commitmentId: string; decision: "accepted" | "rejected"; components: string[] | null; note: string | null }) {
  const store = getBriefStore();
  if (!store) throw new Error("The brief store is not configured.");
  const { error } = await store.from("brief_commitment_reviews").upsert({
    commitment_id: input.commitmentId,
    decision: input.decision,
    components: input.components,
    note: input.note,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Accepts commitments with the model's components. One that already has a decision keeps it, even if it was made after the page loaded. */
export async function acceptCommitments(commitmentIds: readonly string[]) {
  const store = getBriefStore();
  if (!store) throw new Error("The brief store is not configured.");
  const reviewedAt = new Date().toISOString();
  await inChunks(commitmentIds, async (chunk) => {
    const rows = chunk.map((id) => ({ commitment_id: id, decision: "accepted", components: null, note: null, reviewed_at: reviewedAt }));
    const { error } = await store.from("brief_commitment_reviews").upsert(rows, { onConflict: "commitment_id", ignoreDuplicates: true });
    if (error) throw error;
    return [];
  });
}

export async function saveUnitReview(input: {
  countryCode: string;
  releaseKey: string;
  unitKey: string;
  pillar: Pillar;
  status: "reviewed" | "withheld";
  note: string | null;
  factSheetVersion: number;
  promptVersion: string;
  contentHash: string;
}) {
  const store = getBriefStore();
  if (!store) throw new Error("The brief store is not configured.");
  const { error } = await store.from("brief_unit_reviews").upsert({
    country_code: input.countryCode,
    release_key: input.releaseKey,
    unit_key: input.unitKey,
    pillar: input.pillar,
    status: input.status,
    note: input.note,
    fact_sheet_version: input.factSheetVersion,
    prompt_version: input.promptVersion,
    content_hash: input.contentHash,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** One country's local plans with readable text, for the review queue; null when the store is not available. */
export async function listCountryPlans(country: Country) {
  const store = getBriefStore();
  if (!store) return null;
  const { data, error } = await store.from("brief_plan_documents").select("id, url, title, units, script, status").eq("country_code", country.code).eq("level", "local").eq("status", "text");
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return data as StoredPlan[];
}

/** Every pillar review recorded for a country's release, keyed by unit. */
export async function listUnitReviews(countryCode: string, releaseKey: string) {
  const store = getBriefStore();
  if (!store) return new Map<string, Array<{ pillar: Pillar; status: string }>>();
  const { data, error } = await store.from("brief_unit_reviews").select("unit_key, pillar, status").eq("country_code", countryCode).eq("release_key", releaseKey);
  const byUnit = new Map<string, Array<{ pillar: Pillar; status: string }>>();
  if (isMissingTable(error)) return byUnit;
  if (error) throw error;
  for (const row of data ?? []) byUnit.set(row.unit_key, [...(byUnit.get(row.unit_key) ?? []), { pillar: row.pillar as Pillar, status: row.status }]);
  return byUnit;
}
