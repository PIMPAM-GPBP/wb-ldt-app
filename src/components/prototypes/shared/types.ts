import type { Country } from "@/lib/countries";
import type { AnalyticsPageData } from "@/types/analytics";

export const VARIANTS = [
  { id: "atlas", key: "1", label: "A. Atlas" },
  { id: "report", key: "2", label: "B. Report" },
  { id: "minimal", key: "3", label: "C. Minimal" },
] as const;

export type VariantId = (typeof VARIANTS)[number]["id"];

export function parseVariant(value: string | string[] | undefined): VariantId {
  const raw = Array.isArray(value) ? value[0] : value;
  return VARIANTS.find((variant) => variant.id === raw)?.id ?? "atlas";
}

/** Every variant receives the same server data, loaded with tab=single. */
export type PrototypeViewProps = {
  data: AnalyticsPageData;
  country: Country;
};
