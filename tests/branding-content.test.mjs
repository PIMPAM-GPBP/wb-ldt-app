import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("branding assets and PIL diagram are wired into the app", async () => {
  await Promise.all([
    access("images/gpb-logo.png"),
    access("images/ldt-logo-dark.png"),
    access("images/pimpam_logo.png"),
    access("images/PIL Diagram v2.png"),
    access("images/about-ldt-size-distribution.png"),
    access("images/about-ldt-3d-pil-ranking.png"),
    access("images/about-ldt-2d-quadrant.png"),
    access("images/about-ldt-strategy-availability.png"),
    access("images/about-ldt-population-distribution.png"),
    access("images/about-ldt-ai-swot.png"),
    access("images/about-ldt-ai-recommendations.png"),
    access("images/about-ldt-project-selection.png"),
  ]);

  const header = await readFile("src/components/layout/app-header.tsx", "utf8");
  const suiteBranding = await readFile("src/components/layout/gpb-suite-branding.tsx", "utf8");
  const home = await readFile("src/app/page.tsx", "utf8");
  const methodology = await readFile("src/app/methodology/page.tsx", "utf8");
  const layoutBranding = `${header}\n${suiteBranding}`;

  assert.match(layoutBranding, /images\/gpb-logo\.png/);
  assert.match(layoutBranding, /images\/ldt-logo-dark\.png/);
  assert.match(layoutBranding, /images\/pimpam_logo\.png/);
  // The framework diagram lives on Methodology; the home page leads with the country maps.
  assert.match(methodology, /PIL Diagram v2\.png/);
  assert.doesNotMatch(home, /PIL Diagram v2\.png/);
});

test("global typography follows the requested Fira Sans and Inter stack", async () => {
  const css = await readFile("src/app/globals.css", "utf8");

  assert.match(css, /Fira\+Sans/);
  assert.match(css, /family=Fira\+Sans/);
  assert.match(css, /family=Fira\+Sans.*family=Inter/s);
  assert.match(css, /--font-sans: "Inter", "Roboto", "Arial", sans-serif;/);
  assert.match(css, /--font-heading: "Fira Sans", "Trebuchet MS", sans-serif;/);
});

test("global color tokens follow the GPB primary palette", async () => {
  const css = await readFile("src/app/globals.css", "utf8");

  assert.match(css, /--primary: #374291;/);
  assert.match(css, /--foreground: #374291;/);
  assert.match(css, /--muted-foreground: #3675b7;/);
  assert.match(css, /--accent: #3675b7;/);
  assert.match(css, /--gpb-chrome-bg: #021420;/);
  assert.match(css, /--gpb-chrome-link: #c9d3ea;/);
  assert.match(css, /--background: #021420;/);
});

test("header navigation links to the About page instead of country anchors", async () => {
  const siteLinks = await readFile("src/components/layout/site-links.ts", "utf8");
  const headerBlock = siteLinks.match(/export const headerNavItems = \[[\s\S]*?\] as const;/)?.[0] ?? "";

  assert.match(headerBlock, /\{ href: "\/about", label: "About", exact: false \}/);
  // Renamed from Resources on 2026-10-30, once the page offered the data itself; the URL kept its old path.
  assert.match(headerBlock, /\{ href: "\/resources", label: "Data", exact: false \}/);
  assert.match(
    headerBlock,
    /label: "Methodology"[\s\S]*label: "Data"[\s\S]*label: "Data updates"/,
  );
  assert.doesNotMatch(headerBlock, /label: "Countries"/);
  assert.doesNotMatch(headerBlock, /#country-workspaces/);
});

test("resources page exposes core LDT Drive materials", async () => {
  const resourcesPage = await readFile("src/app/resources/page.tsx", "utf8");
  const resourcesData = await readFile("src/lib/resources.ts", "utf8");
  const siteLinks = await readFile("src/components/layout/site-links.ts", "utf8");

  assert.match(siteLinks, /href: "\/resources", label: "Data"/);
  assert.match(resourcesPage, /Core LDT materials/);
  assert.doesNotMatch(resourcesPage, /Open Drive folder/);
  assert.doesNotMatch(resourcesPage, /ldtResourceFolder\.description/);
  assert.match(resourcesData, /1wUbAx7svxoAI-1de5EUHzijQSiAv5Q-a/);
  assert.match(resourcesData, /pim-pam\.net GPB LDT Briefing 2026-05-23/);
  assert.match(resourcesData, /GPBP LDT v1\.4 one-pager/);
  assert.match(resourcesData, /GPBP LDT v1\.4 intro deck/);
});

test("resources page exposes country document workspaces", async () => {
  const resourcesPage = await readFile("src/app/resources/page.tsx", "utf8");
  const resourcesData = await readFile("src/lib/resources.ts", "utf8");

  assert.match(resourcesPage, /Documents, demos, and analyses by country/);
  assert.match(resourcesData, /countryResourcePacks/);
  assert.match(resourcesData, /1WIOlbm9Et6-0CdmwCtw8KAIEqLdtcJbV/);
  assert.match(resourcesData, /1bAHP-gN_0uLIIhCxhkkMBADylAvmbQdj/);
  assert.match(resourcesData, /115tYIXw9uxTD_MFFDQYYz66sHdqf7Inx/);
  assert.match(resourcesData, /PIM-PAM SRB SNG LIID Update 2026-06-09/);
  assert.match(resourcesData, /LIID Serbia - Migration & Jobs Creation Analyses/);
  assert.match(resourcesData, /Pim-Pam\.net GPBP Zambia Demos/);
  assert.match(resourcesData, /Zambia AI demo/);
  assert.match(resourcesData, /GPB LDT - Zambia OSR analysis/);
  assert.match(resourcesData, /18DX7cuGtZcmtet1qMurQpHri_SvNQhRp/);
  assert.match(resourcesData, /No top-level files were listed/);
});

// The QuickStart note moved from /about to /resources/quickstart on 2026-10-30, kept as published.
test("the QuickStart note follows the GPB LDT briefing content", async () => {
  const about = await readFile("src/app/resources/quickstart/page.tsx", "utf8");

  assert.match(about, /Local Development Tracker QuickStart/);
  assert.match(about, /lg:whitespace-nowrap/);
  assert.match(about, /The sub-national challenge/);
  assert.match(about, /The method: two layers, any country/);
  assert.match(about, /Figure 1\. Panel of GPB LDT country demo highlights/);
  assert.match(about, /Replicability: adding the next country/);
  assert.match(about, /Selected country findings/);
  assert.match(about, /161 Local Self Governments \(LSGs\)\*\*/);
  assert.match(about, /~94%\*\*\*/);
  assert.match(about, /~97%/);
  assert.match(about, /the 94% figure does not include Kosovo/);
  assert.doesNotMatch(about, /145 Local Self Governments \(LSGs\)\*\*/);
  assert.doesNotMatch(about, /~90%\*\*\*/);
  assert.doesNotMatch(about, /the 95% figure does not include Kosovo/);
  assert.match(about, /about-ldt-ai-recommendations\.png/);
  assert.match(about, /about-ldt-project-selection\.png/);
  assert.doesNotMatch(about, /Release 0\.7/);
  assert.doesNotMatch(about, /ldt\.pim-pam\.net/);
  assert.doesNotMatch(about, /about-ldt-world-bank-logo\.png/);
  assert.doesNotMatch(about, /about-ldt-pimpam-logo\.png/);
  assert.doesNotMatch(about, /about-ldt-gpb-tools-logo\.png/);
});

// Failure mode: Methodology goes back to saying missing components are skipped, which the
// Phase 1 data check showed is false (the score tables count a fixed value for them).
test("methodology states the real treatment of unrecorded components and dates the correction", async () => {
  const methodology = await readFile("src/app/methodology/page.tsx", "utf8");

  assert.doesNotMatch(methodology, /skipped in aggregation where the prepared score tables/);
  assert.match(methodology, /count a fixed value for it/);
  assert.match(methodology, /Changes to this page/);
});

// Failure mode: the data page lists a download that no route or file serves.
test("every file on the data page is served by a route or a public file", async () => {
  const { access } = await import("node:fs/promises");
  const page = await readFile("src/app/resources/page.tsx", "utf8");
  const downloads = await readFile("src/lib/downloads.ts", "utf8");

  assert.match(page, /getDownloads/);
  assert.match(downloads, /\/api\/countries\/\$\{country\.slug\}\/scores/);
  assert.match(downloads, /"\/api\/indicators"/);
  await access("src/app/api/countries/[country]/scores/route.ts");
  await access("src/app/api/indicators/route.ts");
  for (const file of ["public/data/nepal-municipalities.geojson", "public/data/serbia/municipalities.geojson", "public/data/zambia/municipalities.geojson"]) {
    await access(file);
  }
});
