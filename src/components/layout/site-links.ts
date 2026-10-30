// The logo links home and the country menu sits before these, so the header names content only.
export const headerNavItems = [
  { href: "/about", label: "About", exact: false },
  { href: "/methodology", label: "Methodology", exact: false },
  { href: "/resources", label: "Data", exact: false },
  { href: "/data-updates", label: "Data updates", exact: false },
] as const;

/** The footer's data links; the header carries the rest, so the footer does not repeat it. */
export const footerNavItems = [
  { href: "/resources", label: "Get the data" },
  { href: "/data-updates", label: "Data updates" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about#cite", label: "How to cite" },
] as const;

export const countryWorkspaceLinks = [
  { href: "/nepal", label: "Nepal" },
  { href: "/serbia", label: "Serbia" },
  { href: "/zambia", label: "Zambia" },
] as const;

/** Parameters that mean the same thing in every country; unit, province, and year ones do not carry over. */
export const SHARED_VIEW_PARAMS = ["tab", "metric"] as const;

/** The country whose pages the path is in, if any. */
export function currentCountry(pathname: string) {
  return countryWorkspaceLinks.find((country) => pathname === country.href || pathname.startsWith(`${country.href}/`)) ?? null;
}

/**
 * Where a country link goes from the current page: from a map, compare, or brief view, the same
 * view in the other country; from anywhere else, including a strategy inventory Nepal lacks,
 * the country page.
 */
export function countryHref(pathname: string, href: string) {
  const current = currentCountry(pathname);
  const rest = current ? pathname.slice(current.href.length) : "";
  return rest.startsWith("/analytics") ? `${href}/analytics` : href;
}
