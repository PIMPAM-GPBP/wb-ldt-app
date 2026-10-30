import type { Country } from "@/lib/countries";

export type CountryWorkspaceLink = {
  label: string;
  href: string;
  primary: boolean;
};

/** The ways from a country page into its data. Strategy inventory exists only where its page does. */
export function getCountryWorkspaceLinks(country: Country): CountryWorkspaceLink[] {
  return [
    { label: "Open the map", href: `/${country.slug}/analytics`, primary: true },
    { label: "Compare", href: `/${country.slug}/analytics?tab=multi`, primary: false },
    { label: "Planning briefs", href: `/${country.slug}/analytics?tab=brief`, primary: false },
    ...(country.slug === "serbia" || country.slug === "zambia"
      ? [{ label: "Strategy inventory", href: `/${country.slug}/strategy-inventory`, primary: false }]
      : []),
  ];
}
