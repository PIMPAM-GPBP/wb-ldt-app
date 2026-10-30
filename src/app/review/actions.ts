"use server";

import { revalidatePath } from "next/cache";

import type { Pillar } from "@/types/analytics";

import { getFactSheet, listUnits } from "@/lib/brief/brief-data";
import type { FactSheet } from "@/lib/brief/facts";
import { pillarContentHash } from "@/lib/brief/plan-view";
import { undecided } from "@/lib/brief/review";
import { acceptCommitments, loadUnitPlanData, saveCommitmentDecision, saveUnitReview } from "@/lib/brief/store";
import { reviewConsoleEnabled } from "@/lib/brief/supabase";
import { getCountryByCode } from "@/lib/countries";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/plans/extract";

const PILLARS: Pillar[] = ["prosperity", "infrastructure", "livability"];

/** Decisions are recorded only from the local review console; a deployed build refuses them. */
function requireReviewConsole() {
  if (!reviewConsoleEnabled()) throw new Error("The review console runs only on the local dev server.");
}

async function unitContext(countryCode: string, unitKey: string) {
  const country = getCountryByCode(countryCode);
  if (!country) throw new Error(`Unknown country ${countryCode}.`);
  const unit = (await listUnits(country)).find((entry) => entry.key === unitKey);
  const sheet = unit ? await getFactSheet(country, unit.compositeKey) : null;
  if (!unit || !sheet) throw new Error(`Unknown unit ${unitKey}.`);
  return { country, unit, sheet };
}

const componentKeysOf = (sheet: FactSheet, pillar: Pillar) => sheet.pillars.find((entry) => entry.key === pillar)?.components.map((component) => component.key) ?? [];

const text = (value: FormDataEntryValue | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, 1000) : null;
};

export async function decideCommitment(formData: FormData) {
  const countryCode = String(formData.get("country"));
  const unitKey = String(formData.get("unit"));
  const returnTo = `/review/${countryCode.toLowerCase()}/${unitKey}`;
  requireReviewConsole();
  const { sheet } = await unitContext(countryCode, unitKey);

  const known = new Set(sheet.pillars.flatMap((pillar) => pillar.components.map((component) => component.key)));
  const decision = formData.get("decision") === "rejected" ? "rejected" : "accepted";
  const original = String(formData.get("original") ?? "").split(",").filter(Boolean).sort();
  const chosen = [...new Set(formData.getAll("components").map(String).filter((key) => known.has(key)))].sort();
  if (decision === "accepted" && chosen.length === 0) throw new Error("An accepted commitment needs at least one component.");

  await saveCommitmentDecision({
    commitmentId: String(formData.get("commitment")),
    decision,
    // Store a correction only when the reviewer changed the model's components.
    components: decision === "accepted" && chosen.join(",") !== original.join(",") ? chosen : null,
    note: text(formData.get("note")),
  });
  revalidatePath(returnTo);
}

export async function reviewPillar(formData: FormData) {
  const countryCode = String(formData.get("country"));
  const unitKey = String(formData.get("unit"));
  const pillar = String(formData.get("pillar")) as Pillar;
  const returnTo = `/review/${countryCode.toLowerCase()}/${unitKey}`;
  requireReviewConsole();
  if (!PILLARS.includes(pillar)) throw new Error(`Unknown pillar ${pillar}.`);
  const { country, unit, sheet } = await unitContext(countryCode, unitKey);
  const status = formData.get("status") === "withheld" ? "withheld" : "reviewed";

  // The hash is computed here from the stored decisions, never taken from the form.
  const data = await loadUnitPlanData(country, sheet.release.key, unit);
  if (!data.available) throw new Error("The brief store is not available.");
  if (status === "reviewed" && undecided(data.commitments, componentKeysOf(sheet, pillar)).length > 0) {
    throw new Error("Decide every commitment on this score before marking it reviewed.");
  }

  await saveUnitReview({
    countryCode: country.code,
    releaseKey: sheet.release.key,
    unitKey,
    pillar,
    status,
    note: text(formData.get("note")),
    factSheetVersion: sheet.version,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    contentHash: pillarContentHash(sheet, pillar, data.commitments),
  });
  revalidatePath(returnTo);
  revalidatePath(`/${country.slug}/analytics`);
}

/**
 * Accepts, with the model's components, every commitment on a score that the page listed as
 * undecided and that is still undecided now. Rejections and corrections are never touched.
 */
export async function acceptUndecided(formData: FormData) {
  const countryCode = String(formData.get("country"));
  const unitKey = String(formData.get("unit"));
  const pillar = String(formData.get("pillar")) as Pillar;
  const returnTo = `/review/${countryCode.toLowerCase()}/${unitKey}`;
  requireReviewConsole();
  if (!PILLARS.includes(pillar)) throw new Error(`Unknown pillar ${pillar}.`);
  const { country, unit, sheet } = await unitContext(countryCode, unitKey);

  const data = await loadUnitPlanData(country, sheet.release.key, unit);
  if (!data.available) throw new Error("The brief store is not available.");
  const shown = new Set(String(formData.get("shown") ?? "").split(",").filter(Boolean));
  await acceptCommitments(undecided(data.commitments, componentKeysOf(sheet, pillar)).filter((commitment) => shown.has(commitment.id)).map((commitment) => commitment.id));
  revalidatePath(returnTo);
}
