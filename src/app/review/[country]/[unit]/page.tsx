import Link from "next/link";
import { notFound } from "next/navigation";

import type { Pillar } from "@/types/analytics";

import { acceptUndecided, decideCommitment, reviewPillar } from "@/app/review/actions";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { getFactSheet, listUnits } from "@/lib/brief/brief-data";
import { MACHINE_TRANSLATION, displayQuote, pageLink } from "@/lib/brief/plan-sections";
import { pillarContentHash, pillarPlanView } from "@/lib/brief/plan-view";
import { applyReview, undecided, visibility, type StoredCommitment } from "@/lib/brief/review";
import { loadUnitPlanData } from "@/lib/brief/store";
import { reviewConsoleEnabled } from "@/lib/brief/supabase";
import { getCountryByCode } from "@/lib/countries";

export const metadata = { title: "Review a brief" };

const PILLAR_ORDER: Pillar[] = ["prosperity", "infrastructure", "livability"];
const LINK =
  "rounded-sm text-accent underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";
const FIELD = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";

const componentName = (label: string) => label.replace(/ Score$/, "");
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

type Params = Promise<{ country: string; unit: string }>;

export default async function ReviewUnitPage({ params }: { params: Params }) {
  if (!reviewConsoleEnabled()) notFound();
  const { country: countryParam, unit: unitKey } = await params;

  const country = getCountryByCode(countryParam.toUpperCase());
  const unit = country ? (await listUnits(country)).find((entry) => entry.key === unitKey) : undefined;
  const sheet = country && unit ? await getFactSheet(country, unit.compositeKey) : null;
  if (!country || !unit || !sheet) notFound();

  const data = await loadUnitPlanData(country, sheet.release.key, unit);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/review" className={`${LINK} text-sm`}>
        Review queue
      </Link>
      <h1 className="mt-3 font-heading text-3xl leading-tight font-semibold text-ink">{unit.name}</h1>
      <p className="mt-1 text-base text-ink-muted">
        {unit.province}, {country.name}. Sections two and three of the planning brief.
      </p>

      {!data.available ? (
        <p className="mt-8 text-base text-ink-muted">The plan store is not available on this server.</p>
      ) : (
        <>
          <div className="mt-6 text-sm leading-6 text-ink">
            {data.plans.length === 0 ? (
              <p className="text-ink-muted">No local plan with readable text covers this unit, so there is nothing to review.</p>
            ) : (
              data.plans.map((plan) => (
                <p key={plan.id}>
                  Local plan:{" "}
                  <a href={plan.url} target="_blank" rel="noreferrer" className={LINK}>
                    {plan.title}
                  </a>
                  {plan.units.length > 1 ? (
                    <span className="text-ink-muted">. Shared by {plan.units.length} units; a decision on its commitments applies to all of them.</span>
                  ) : null}
                </p>
              ))
            )}
          </div>

          {PILLAR_ORDER.map((pillarKey) => {
            const pillar = sheet.pillars.find((entry) => entry.key === pillarKey);
            if (!pillar) return null;
            const hasPlan = data.plans.length > 0;
            const draft = pillarPlanView(sheet, pillarKey, data.commitments, "draft", hasPlan);
            const review = data.reviews.get(pillarKey) ?? null;
            const currentHash = pillarContentHash(sheet, pillarKey, data.commitments);
            const publicView = visibility(review, currentHash);
            const open = undecided(data.commitments, draft.componentKeys);
            const onPillar = data.commitments
              .filter((commitment) => (applyReview(commitment) ?? commitment).components.some((key) => draft.componentKeys.includes(key)) || commitment.components.some((key) => draft.componentKeys.includes(key)))
              .sort((a, b) => order(a) - order(b) || a.page - b.page);

            return (
              <Section key={pillarKey} title={pillar.label} className="mt-10" headingLevel="h2">
                <p className="mt-2 text-sm text-ink">
                  {publicView.kind === "reviewed"
                    ? `The public sees these sections, reviewed on ${formatDate(publicView.reviewedAt)}.`
                    : publicView.kind === "withheld"
                      ? `Withheld${review?.note ? `: ${review.note}` : ""}. Nobody outside this console sees these sections.`
                      : review
                        ? `Changed since its review on ${formatDate(review.reviewedAt)}; the public sees "in review" until it is reviewed again.`
                        : `Not reviewed; the public sees "in review".`}
                </p>

                <div className="mt-5 grid gap-8 lg:grid-cols-[3fr_2fr]">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Commitments on this score ({onPillar.length}, {open.length} undecided)
                    </h3>
                    {onPillar.length === 0 ? <p className="mt-2 text-sm text-ink-muted">None.</p> : null}
                    {open.length > 0 ? (
                      <form action={acceptUndecided} className="mt-2 space-y-1">
                        <input type="hidden" name="country" value={country.code} />
                        <input type="hidden" name="unit" value={unit.key} />
                        <input type="hidden" name="pillar" value={pillarKey} />
                        <input type="hidden" name="shown" value={open.map((commitment) => commitment.id).join(",")} />
                        <Button type="submit" size="sm" variant="outline">
                          Accept all undecided ({open.length})
                        </Button>
                        <p className="text-xs text-ink-muted">Reject or correct any you disagree with first. This accepts the rest with the model&apos;s components, on every score they touch.</p>
                      </form>
                    ) : null}
                    <ul className="mt-2 divide-y divide-[var(--border-soft)]">
                      {onPillar.map((commitment) => (
                        <CommitmentItem
                          key={`${pillarKey}-${commitment.id}`}
                          commitment={commitment}
                          countryCode={country.code}
                          unitKey={unit.key}
                          options={[...new Set([...draft.componentKeys, ...commitment.components, ...(commitment.review?.components ?? [])])]}
                          labels={new Map(sheet.pillars.flatMap((entry) => entry.components.map((component) => [component.key, componentName(component.label)])))}
                        />
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-ink">Coverage gaps, as drafted</h3>
                    <table className="mt-2 w-full text-sm tabular-nums">
                      <thead>
                        <tr className="border-b border-[var(--border-soft)] text-left text-ink-muted">
                          <th className="py-1 pr-2 font-medium">Component</th>
                          <th className="py-1 pr-2 font-medium">Score</th>
                          <th className="py-1 font-medium">Plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.rows.map((row) => (
                          <tr key={row.component.key} className="border-b border-[var(--border-soft)]">
                            <td className="py-1 pr-2 text-ink">{componentName(row.component.label)}</td>
                            <td className="py-1 pr-2 text-ink-muted">{row.scoreStatus}</td>
                            <td className="py-1 text-ink-muted">{hasPlan ? `${row.salience} (${row.commitments.length})` : "no plan"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink">
                      {draft.sentences.map((sentence) => (
                        <li key={sentence.text}>{sentence.text}</li>
                      ))}
                    </ul>

                    <form action={reviewPillar} className="mt-5 space-y-2 border-t border-[var(--border-soft)] pt-4">
                      <input type="hidden" name="country" value={country.code} />
                      <input type="hidden" name="unit" value={unit.key} />
                      <input type="hidden" name="pillar" value={pillarKey} />
                      <label className="block text-sm text-ink" htmlFor={`note-${pillarKey}`}>
                        Note for the record (optional)
                      </label>
                      <textarea id={`note-${pillarKey}`} name="note" rows={2} className={`${FIELD} w-full`} />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="status" value="reviewed" size="sm" disabled={open.length > 0}>
                          Mark reviewed
                        </Button>
                        <Button type="submit" name="status" value="withheld" size="sm" variant="outline">
                          Withhold
                        </Button>
                      </div>
                      {open.length > 0 ? <p className="text-xs text-ink-muted">Decide the {open.length} undecided commitments first.</p> : null}
                    </form>
                  </div>
                </div>
              </Section>
            );
          })}
        </>
      )}
    </main>
  );
}

/** Undecided first, then accepted, then rejected. */
function order(commitment: StoredCommitment) {
  return commitment.review === null ? 0 : commitment.review.decision === "accepted" ? 1 : 2;
}

function CommitmentItem({
  commitment,
  countryCode,
  unitKey,
  options,
  labels,
}: {
  commitment: StoredCommitment;
  countryCode: string;
  unitKey: string;
  options: string[];
  labels: Map<string, string>;
}) {
  const effective = commitment.review?.components ?? commitment.components;
  const state = commitment.review === null ? "Undecided" : commitment.review.decision === "accepted" ? (commitment.review.components ? "Accepted, components corrected" : "Accepted") : "Rejected";
  return (
    <li className="py-3">
      <blockquote className={`border-l-2 border-[var(--border-strong)] pl-3 text-sm leading-6 ${commitment.review?.decision === "rejected" ? "text-ink-muted line-through" : "text-ink"}`}>
        {displayQuote(commitment.quote)}
      </blockquote>
      {commitment.english ? (
        <p className="mt-1 pl-3 text-sm text-ink-muted">
          <span className="font-medium">{MACHINE_TRANSLATION}:</span> {commitment.english}
        </p>
      ) : null}
      <p className="mt-1 pl-3 text-xs text-ink-muted">
        <a href={pageLink(commitment)} target="_blank" rel="noreferrer" className={LINK}>
          Page {commitment.page}
        </a>
        {` · ${commitment.kind}, ${commitment.strength} · model: ${commitment.components.map((key) => labels.get(key) ?? key).join(", ")} · `}
        <span className="font-medium text-ink">{state}</span>
      </p>
      <form action={decideCommitment} className="mt-2 pl-3">
        <input type="hidden" name="country" value={countryCode} />
        <input type="hidden" name="unit" value={unitKey} />
        <input type="hidden" name="commitment" value={commitment.id} />
        <input type="hidden" name="original" value={commitment.components.join(",")} />
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="sr-only">Components this commitment changes</legend>
          {options.map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-xs text-ink">
              <input type="checkbox" name="components" value={key} defaultChecked={effective.includes(key)} />
              {labels.get(key) ?? key}
            </label>
          ))}
        </fieldset>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input name="note" placeholder="Note (optional)" aria-label="Note (optional)" className={`${FIELD} w-56`} />
          <Button type="submit" name="decision" value="accepted" size="sm" variant="outline">
            Accept
          </Button>
          <Button type="submit" name="decision" value="rejected" size="sm" variant="outline">
            Reject
          </Button>
        </div>
      </form>
    </li>
  );
}
