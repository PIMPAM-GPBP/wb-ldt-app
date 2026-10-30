import Link from "next/link";
import { notFound } from "next/navigation";

import { Section } from "@/components/ui/section";
import { getRelease, listUnits } from "@/lib/brief/brief-data";
import golden from "@/lib/brief/golden-set.json";
import { listCountryPlans, listUnitReviews, normalizeName } from "@/lib/brief/store";
import { reviewConsoleEnabled } from "@/lib/brief/supabase";
import { countries } from "@/lib/countries";

export const metadata = { title: "Review briefs" };

const LINK =
  "rounded-sm text-accent underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";

/**
 * The review queue, in decision 3's order: the golden set first, then every other unit with a
 * readable local plan. Units without one have no model-derived sections to review.
 */
export default async function ReviewQueuePage() {
  if (!reviewConsoleEnabled()) notFound();

  const groups = await Promise.all(
    countries
      .filter((country) => country.analyticsStatus === "live")
      .map(async (country) => {
        const [units, plans, release] = await Promise.all([listUnits(country), listCountryPlans(country), getRelease(country)]);
        const goldenKeys = golden.units.filter((unit) => unit.country === country.code).map((unit) => unit.unitKey);
        const byPlans = country.planningDocuments.planSourceAdminLevel === "lower";
        const planned = new Set((plans ?? []).flatMap((plan) => plan.units.map(normalizeName)));
        const withPlan = byPlans ? units.filter((unit) => planned.has(normalizeName(unit.name)) && !goldenKeys.includes(unit.key)) : [];
        const ordered = [
          ...goldenKeys.map((key) => units.find((unit) => unit.key === key)).filter((unit) => unit !== undefined),
          ...withPlan.sort((a, b) => a.name.localeCompare(b.name)),
        ];
        const reviews = await listUnitReviews(country.code, release.key);
        return { country, ordered, goldenCount: goldenKeys.length, plansAvailable: plans !== null, byPlans, reviews };
      }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl leading-tight font-semibold text-ink">Review briefs</h1>
      <p className="mt-2 text-sm text-ink-muted">This console runs only on your local dev server. The deployed site shows readers only the scores you mark reviewed.</p>

      {groups.map(({ country, ordered, goldenCount, plansAvailable, byPlans, reviews }) => (
        <Section key={country.code} title={country.name} className="mt-10" description={plansAvailable ? `${ordered.length} units to review, the golden set first.` : "The plan store is not available."}>
          {!byPlans ? (
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              {country.name}&apos;s plans come from provinces, so one plan is shared by every {country.adminLabels.lower.singular.toLowerCase()} in its province. Review them through the golden-set units below.
            </p>
          ) : null}
          <ol className="mt-4 divide-y divide-[var(--border-soft)]">
            {ordered.map((unit, index) => {
              const done = reviews.get(unit.key) ?? [];
              const reviewed = done.filter((entry) => entry.status === "reviewed").length;
              const withheld = done.filter((entry) => entry.status === "withheld").length;
              return (
                <li key={unit.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span>
                    <Link href={`/review/${country.code.toLowerCase()}/${unit.key}`} className={LINK}>
                      {unit.name}
                    </Link>
                    <span className="text-sm text-ink-muted">
                      {" "}
                      {unit.province}
                      {index < goldenCount ? ", golden set" : ""}
                    </span>
                  </span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {reviewed} of 3 scores reviewed{withheld ? `, ${withheld} withheld` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>
      ))}
    </main>
  );
}
