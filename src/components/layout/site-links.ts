export const headerNavItems = [
  { href: "/", label: "Home", exact: true },
  { href: "/about", label: "About", exact: false },
  { href: "/methodology", label: "Methodology", exact: false },
  { href: "/roadmap", label: "Roadmap", exact: false },
  { href: "/resources", label: "Resources", exact: false },
  { href: "/release-notes", label: "Release Notes", exact: false },
] as const;

export const footerNavItems = [
  { href: "/", label: "Home" },
  { href: "/#country-workspaces", label: "Country workspaces" },
  { href: "/resources", label: "Resources" },
  { href: "/methodology", label: "Methodology" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/release-notes", label: "Release Notes" },
  { href: "/about", label: "About" },
] as const;

export const countryWorkspaceLinks = [
  { href: "/nepal", label: "Nepal" },
  { href: "/serbia", label: "Serbia" },
  { href: "/zambia", label: "Zambia" },
  { href: "/vietnam", label: "Vietnam" },
] as const;
