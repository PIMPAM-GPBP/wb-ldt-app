import Link from "next/link";

import { CountryContextPanel } from "@/components/country/country-context-panel";
import { CountryDetailLoader } from "@/components/country/country-detail-loader";
import { CountryTrustCard } from "@/components/country/country-trust-card";
import { buildCountryHomeModel } from "@/lib/country-home";
import {
  getCountryCommandCenterTasks,
  getCountryLandingActions,
} from "@/lib/country-landing-actions";
import {
  loadCountryDataset,
  loadLocalPlanSources,
} from "@/lib/country-landing-data";
import { getPlanAvailabilityDisclosure } from "@/lib/country-plan-availability";
import { buildCountryTrustModel } from "@/lib/country-trust";
import type { Country } from "@/lib/countries";
import { getReleaseMetadataBySlug } from "@/lib/release-metadata";

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function CountryAdminLevelGuide({
  country,
  adminCountSummary,
}: {
  country: Country;
  adminCountSummary: string;
}) {
  const guide = country.adminLevelGuide;

  return (
    <section
      className="mx-auto mt-6 w-full max-w-7xl px-6 sm:px-8 lg:px-12"
      aria-labelledby={`${country.slug}-admin-level-guide-heading`}
    >
      <article className="rounded-[1.9rem] border border-[var(--border-strong)] bg-white/80 p-7 shadow-[0_18px_45px_rgba(2,20,32,0.08)]">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Administrative context
            </p>
            <h2
              id={`${country.slug}-admin-level-guide-heading`}
              className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Admin levels 1 and 2 in {country.name}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
              {guide.summary}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
              {adminCountSummary}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
              {guide.note}
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            {guide.levels.map((level) => (
              <div
                key={`${level.label}-${level.name}`}
                className="rounded-[1.35rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5"
              >
                <dt>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {level.label}
                  </span>
                  <span className="mt-2 block text-xl font-semibold text-[var(--foreground)]">
                    {level.name}
                  </span>
                </dt>
                <dd className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  {level.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-soft)] pt-5 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Sources
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.sourceLinks.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] dark:bg-[var(--surface-strong)]"
              >
                {source.label}
              </a>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

export async function CountryLandingPage({ country }: { country: Country }) {
  const dataset = await loadCountryDataset(country);
  const releaseMetadata = getReleaseMetadataBySlug(country.slug);
  const planSources = await loadLocalPlanSources(country);
  const model = buildCountryHomeModel(country, dataset);
  const lowerSingular = country.adminLabels.lower.singular;
  const lowerPlural = country.adminLabels.lower.plural;
  const higherSingular = country.adminLabels.higher.singular;
  const higherPlural = country.adminLabels.higher.plural;
  const lowerSingularLabel = lowerFirst(lowerSingular);
  const lowerPluralLabel = lowerFirst(lowerPlural);
  const higherPluralLabel = lowerFirst(higherPlural);
  const actions = getCountryLandingActions(country);
  const commandCenterTasks = getCountryCommandCenterTasks(country);
  const leftActions = actions.filter((action) => action.align === "left");
  const rightActions = actions.filter((action) => action.align === "right");
  const planAvailabilityDisclosure = getPlanAvailabilityDisclosure(country);

  function actionClassName(variant: "primary" | "secondary") {
    const baseClassName =
      "inline-flex min-h-[58px] items-center justify-center rounded-full px-8 py-4 text-base font-medium transition-colors sm:min-w-[12rem]";

    return variant === "primary"
      ? `${baseClassName} bg-[var(--accent)] text-white shadow-[0_12px_28px_rgba(54,117,183,0.24)] transition-transform hover:-translate-y-0.5 hover:brightness-95`
      : `${baseClassName} border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-strong)]`;
  }

  const adminCountSummary = `In the ${model.latestYear} LDT release, Admin level 1 includes ${model.higherCount} ${higherPluralLabel}, and Admin level 2 includes ${model.lowerCount} ${lowerPluralLabel}.`;
  const trustModel = releaseMetadata
    ? buildCountryTrustModel({
        country,
        releaseMetadata,
        groups: model.groups,
        planSources,
      })
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-[var(--border-soft)] bg-[radial-gradient(circle_at_top,var(--hero-glow),transparent_38%),linear-gradient(180deg,var(--hero-wash-start),var(--hero-wash-end))]">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-16 sm:px-8 lg:px-12 lg:py-24">
          <h1 className="mt-6 max-w-6xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-[3.4rem]">
            {country.name} subnational analytics for local economic development
          </h1>
          <p className="mt-6 max-w-4xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
            Review {higherPluralLabel} and {lowerPluralLabel} coverage, compare
            population and PIL indicators, and trace which planning documents are
            available for analysis.
          </p>
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-4 sm:flex-row">
              {leftActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={actionClassName(action.variant)}
                >
                  {action.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-4 sm:ml-auto sm:flex-row">
              {rightActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={actionClassName(action.variant)}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-8 w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <article className="rounded-[1.35rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-[0_14px_34px_rgba(2,20,32,0.08)]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Command center
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                Main tasks for this workspace
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
              Jump directly into comparison, evidence review, planning brief,
              document readiness, or release trust checks.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {commandCenterTasks.map((task) => (
              <Link
                key={task.href}
                href={task.href}
                className="rounded-[0.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {task.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-[var(--muted-foreground)]">
                  {task.description}
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      {trustModel ? <CountryTrustCard model={trustModel} /> : null}

      <section className="mx-auto mt-14 w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <article className="rounded-[1.9rem] border border-[var(--border-strong)] bg-white/80 p-7 shadow-[0_18px_45px_rgba(2,20,32,0.08)]">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Country snapshot
          </p>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Population covered
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                {model.populationLabel}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Land area covered
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                {model.areaLabel}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                National development plan
              </p>
              <a
                href={country.profile.strategy.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-2xl font-semibold text-[var(--foreground)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors hover:text-[var(--accent)]"
              >
                {country.profile.strategy.title}
              </a>
            </div>
          </div>
        </article>
      </section>

      <CountryContextPanel country={country} />

      <CountryAdminLevelGuide
        country={country}
        adminCountSummary={adminCountSummary}
      />

      <section
        id="document-readiness"
        className="mx-auto mt-10 mb-16 w-full max-w-7xl px-6 sm:px-8 lg:px-12"
      >
        <article className="rounded-[1.9rem] border border-[var(--border-strong)] bg-white/80 p-7 shadow-[0_18px_45px_rgba(2,20,32,0.08)]">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Administrative levels
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {higherPlural} and {lowerPlural}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted-foreground)]">
            This country entry point focuses on the subnational tiers used in the
            LDT: {model.higherCount} {higherPluralLabel} and {model.lowerCount}{" "}
            {lowerPluralLabel} in the {model.latestYear} release.
          </p>

          <CountryDetailLoader
            countrySlug={country.slug}
            countryName={country.name}
            labels={{
              lowerSingular,
              lowerPlural,
              higherSingular,
              higherPlural,
              csvFileName: `${country.slug}-sng-${lowerSingularLabel}-metrics.csv`,
            }}
            planAvailabilityDescription={planAvailabilityDisclosure.description}
            planSourceAdminLevel={country.planningDocuments.planSourceAdminLevel}
          />
        </article>
      </section>
    </main>
  );
}
