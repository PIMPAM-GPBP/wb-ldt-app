import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "@/components/prototypes/shared/prototype.css";
import { AtlasView } from "@/components/prototypes/atlas/atlas-view";
import { MinimalView } from "@/components/prototypes/minimal/minimal-view";
import { ReportView } from "@/components/prototypes/report/report-view";
import { parseVariant } from "@/components/prototypes/shared/types";
import { VariantSwitcher } from "@/components/prototypes/variant-switcher";
import { getCountryBySlug } from "@/lib/countries";
import { getAnalyticsPageData } from "@/lib/data/queries";

// Phase 1 of docs/roadmap/LDT-UI-Overhaul-Plan.md. Unlinked, unindexed, and off in production
// builds unless LDT_PROTOTYPES=1. Delete this route once the chosen direction is built.
export const metadata: Metadata = {
  title: "Map & Drivers prototypes",
  robots: { index: false, follow: false },
};

export default async function PrototypesPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production" && process.env.LDT_PROTOTYPES !== "1") {
    notFound();
  }

  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country || country.analyticsStatus !== "live") {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const variant = parseVariant(resolvedSearchParams.v);
  const data = await getAnalyticsPageData({ ...resolvedSearchParams, tab: "single" }, country.code);
  const View = variant === "report" ? ReportView : variant === "minimal" ? MinimalView : AtlasView;

  return (
    <div className="proto-root flex flex-1 flex-col" data-variant={variant}>
      <View data={data} country={country} />
      <VariantSwitcher active={variant} />
    </div>
  );
}
