# LDT UI/UX overhaul plan

Status: proposal, revised 2026-10-29 after the first round of decisions.
Scope: the Next.js frontend in `src/`, reviewed against the live site at ldt.pim-pam.net and five Darkhorse Visualization projects.

## Goal

Make the LDT read as a purpose-built public data tool instead of a generated SaaS template.
Darkhorse is the reference because its award-winning work solves the same problem: composite indices, sub-national choropleths, and country comparisons for policy audiences.

## Decisions

| Decision | Date | Effect on the plan |
| --- | --- | --- |
| Keep the current logos, color scheme, and fonts | 2026-10-29 | Inter, Fira Sans, the GPB navy and blue palette, the chart colors, and the LDT, GPB Suite, and PIM-PAM marks all stay. The change comes from layout, shape, density, copy, and how data is shown. |
| Light first, dark as a toggle | 2026-10-29 | The site opens in light mode for everyone. Today it follows the operating system, so visitors on a dark Mac see dark. The toggle and the saved choice stay. |
| Map tiles | open | See [Map tiles](#map-tiles). |

One assumption needs a check.
I read "keep the color scheme" as keeping the palette, not the effects.
The plan removes the radial glows behind the page and the see-through white panels, and keeps the same colors as flat fills.
If the glows count as part of the scheme, phase 2 keeps them and only the cards change.

## Why it reads as AI-generated today

These are counted from the code and seen on the live site.
None of them depend on the fonts or the palette, which is why keeping both still leaves plenty to fix.

1. Every block is a rounded, shadowed card.
   The code uses 19 different arbitrary radii between `1rem` and `2rem` and 55 custom `shadow-[...]` values.
   Cards nest three deep on the country page: section card, inner card, stat tile.
2. Every section opens with a spaced uppercase eyebrow label.
   There are 111 of them, at four different letter-spacing values.
3. The page background is radial glows over a gradient, and panels are translucent white at 70 to 94 percent opacity.
4. The home hero is the stock pattern of headline, subtitle, four stat tiles, and a select box.
   The stat tiles ("3 country workspaces", "PIL v1.5") describe the app, not the places it measures.
5. The copy describes the software instead of the data.
   "Move through comparison, geographic driver review, and AI-assisted planning outputs without losing the selected year, province, municipality, or metric context" is one example.
   Labels like "Command center", "Trust center", and a four-card "What the LDT provides" grid add to it.
6. The main home visual is a static PNG flowchart with pastel boxes, which reads as a slide.
7. Charts keep library defaults.
   The scatter uses tinted quadrant fills, and the map is a small card over a busy OpenStreetMap raster with labels in Chinese, Hindi, and Urdu competing with the data.

## What Darkhorse does instead

Measured from the live pages with computed styles.

| Project | What to take |
| --- | --- |
| U.S. Climate Vulnerability Index | The map is the page: 1440x840 under a 60px header, with controls floating in panels. Indicator navigation is a tree by category. The legend doubles as a filter ("Click scale to filter map"). A state tile grid gives geographic context. Radii are 3 to 6px and there are almost no shadows. |
| CORE Score (Yale) | Closest analogue to the LDT: a composite wellbeing score built from four categories at county level. The national score is shown large on a 0 to 10 Low to High scale, with the categories as a strip of tabs above it. The URL path encodes index, year, and geography. 2 to 4px radii, no shadows. |
| Global Capitalism Index (UVA) | Rankings, profiles, and compare as the three top-level views. The ranked list shows a delta "since 2024" on every row. Users can pin countries for comparison. |
| Darkhorse solutions page | Charcoal surfaces with one gold accent. The hero copy names the outcome in one sentence. |

The common rules:

- The data is the first thing on the page, not a description of the tool.
- Color is reserved for data. The interface is neutral with one accent.
- Structure comes from rules, spacing, and type scale, not from boxes and shadows.
- Every view has a shareable URL.

## Design direction

A light, map-first atlas in the style of the Climate Vulnerability Index, with CORE Score's way of presenting a composite score, built with the LDT's existing fonts and colors.

### Tokens

| Token | Proposal | Replaces |
| --- | --- | --- |
| Display type | Fira Sans, kept, with a tighter scale: one page title size, one section size, one panel size | Five or more ad hoc heading sizes |
| Numbers | Fira Sans semibold with `tabular-nums` for headline values, Inter `tabular-nums` in tables | `font-mono` on stat values |
| Body type | Inter, kept, at 16px in tools and 17px in articles | 17px everywhere |
| Background | `#F7F9FD`, kept, as a flat fill | The same color under two radial glows |
| Accent | GPB navy `#374291` and blue `#3675B7`, kept, used for links, focus, and selected states | Navy also used for all body text |
| Pillar colors | Prosperity `--chart-5` amber, Infrastructure `--chart-1` blue, Livability `--chart-3` green, matching the framework diagram, reused in every chart, map ramp, and tab | Ad hoc chart colors |
| Ramps | Sequential ramp per pillar for scores. A diverging ramp centered on the national median for "above or below baseline" views | Single light-blue ramp |
| Radius | 4px for controls, 6px for floating panels, 0 for full-width sections | 19 values from 1rem to 2rem |
| Elevation | One shadow token, only on things that float: map panels, popovers, tooltips | 55 custom shadows |
| Section labels | Sentence-case heads; uppercase labels only inside tool panels, at one size and one spacing | 111 eyebrows |
| Surfaces | `--surface`, `--surface-raised`, `--rule`, each with a dark value | `bg-white/70` to `/94` plus `!important` dark overrides |
| Motion | 150 to 200ms ease-out on panels and popovers, nothing on filters or hover lifts, respect reduced motion | Hover lift and glow on buttons |

### Component changes

| Before | After | Why |
| --- | --- | --- |
| `rounded-[1.9rem] border bg-white/80 p-7 shadow-[0_18px_45px_...]` section cards | Full-width section with a 1px top rule and a Fira Sans head | Removes the card-in-card stack that reads as template |
| Translucent `bg-white/*` panels and the `!important` dark overrides in `globals.css` | Semantic surface tokens with a dark theme defined once | The dark-mode bug fixed in phase 0 came from this pattern |
| Pill buttons with a blue glow and `hover:-translate-y-0.5` | 4px-radius buttons, solid or outline, `scale(0.98)` on press | Hover lift on a data tool is decoration seen dozens of times a session |
| Filters with an "Apply" button | Filters apply on change and update the URL | The state is already in the URL, so the extra click buys nothing |
| `<select>` for map metric | Indicator tree: pillar, then its indicators, as on the CVI | Shows the index structure while you navigate it |
| Floating dark legend box with a continuous gradient | Classed legend with 5 to 7 labeled bins that filters the map on click | Readable values and a direct way to find the low performers |
| Scatter quadrant fills | Quadrant labels as text at the corners, gridlines at 50 only, selected municipality annotated with its name | Color stays reserved for province and selection |
| Stat tiles for "Population" and "Land area" in the summary | One line of metadata under the municipality name | These are context, not scores |
| Static PNG of the pillar framework | SVG or HTML diagram that links each indicator to its map | Turns a slide into navigation |

## Map tiles

The basemap is the picture under the municipality polygons.
Today it is the standard OpenStreetMap raster from `tile.openstreetmap.org`, set in `src/lib/maps/map-style.ts`.
It causes four problems.

- It is cartography for navigation: roads, parks, and place names in local scripts, all at full strength under the data.
- It is a raster image, so it can't be restyled for dark mode or have its labels moved above the choropleth.
- It shows Chinese, Hindi, and Urdu labels around Nepal.
- The OpenStreetMap Foundation's tile policy permits light use only, with no service guarantee, and it can block apps that send heavy traffic.

A choropleth basemap needs muted land and water, country and coast lines, English labels drawn above the data, and a matching dark style.

| Option | What it takes | Cost and account | Light and dark | Main risk |
| --- | --- | --- | --- | --- |
| OpenFreeMap Positron and Dark | Change the style URL in `map-style.ts` and insert data layers under the first label layer | Free, no key, no account, no stated view limits. Attribution required | Yes, both exist | Donation-funded, and the site says it offers no SLA |
| MapTiler Cloud "Dataviz" | Same change plus an API key in an env var | Free tier with monthly limits, paid plans with an SLA | Yes, made for choropleths | Account, quota, and a bill if usage grows |
| CARTO Positron and Dark Matter | Same change | Free only under their usage terms. Larger or commercial use needs a license | Yes | Licensing for World Bank use needs checking |
| Self-hosted Protomaps | Extract Nepal, Serbia, Zambia, and neighbors into one `.pmtiles` file, host it on Supabase Storage or Vercel Blob, add the `pmtiles` package | Storage only | Yes, from its style package | More setup, and a re-extract to refresh the data |
| No basemap | Draw our own polygons on the flat background with province lines and a few city labels from our data | None | Yes | No roads or terrain when zoomed into one municipality |

Recommendation: start with OpenFreeMap.
It is a one-file change, has no account or key, and gives both themes.
Its style JSON is ours to edit, so POIs can go, labels can use `name:latin` for English, and labels can sit above the data.
If the World Bank needs a service guarantee or wants no third-party runtime dependency, move to self-hosted Protomaps.
The layer and label work carries over.

## Page plans

### Analytics workspace (`/[country]/analytics`)

This is where users spend their time, so it changes first and most.

- Make the map the canvas: full width under the header, at least 70 percent of viewport height.
- Put indicator navigation in a left rail, grouped by pillar, with the active indicator's definition and source under it.
- Put the selected municipality's profile in a right panel: pillar scores as bars against province and national medians, rank and percentile, then the driver waterfall.
- Keep "Compare" as a second view with the scatter, restyled, plus a beeswarm of all municipalities per pillar so outliers are visible without picking axes.
- Add a sortable table under the map as the accessible fallback, with the existing CSV export.
- Treat the AI planning brief as a report: clear heads, a 68 to 72 character measure, and citations as numbered notes rather than badges.

### Country page (`/nepal`, `/serbia`, `/zambia`)

- Lead with the scores, the way CORE Score does: a strip of the three pillars with the national median for each, and a small distribution plot of every municipality under it.
- Follow with a full-width map that links into the workspace.
- Replace the five-card command center with three plain links: Map, Compare, Planning brief.
- Move "Release trust and AI readiness", the admin-level explanation, and source references into a compact "About this data" band at the bottom.

### Home (`/`)

- Replace the stat-tile hero with the three countries as small-multiple maps, each colored by the same pillar, with one headline number and a link.
- Rewrite the headline to name what is measured and where, for example "Local development scores for 1,028 local governments in Nepal, Serbia, and Zambia".
- Cut the "What the LDT provides" grid, or reduce it to one sentence under the headline.
- Move the framework diagram to Methodology.

### Content pages (About, Methodology, Roadmap, Release notes, Resources)

- One article template: Fira Sans title, Inter body at 17px, 68 to 72 character measure, sidenotes for sources on wide screens.
- Release notes and roadmap as a dated list with rules between entries, not cards.

### Header and footer

- Shorter header: logo, the country switcher, and three links (Methodology, Resources, About).
- Roadmap and Release notes move to the footer.
- The GPB Suite and PIM-PAM marks stay as they are.

## Delivery order

Every phase ends with the same checks, so the sequence proves itself to a reviewer:

- Before and after screenshots of five URLs in light and dark: `/`, `/nepal`, `/nepal/analytics?tab=multi`, `/nepal/analytics?tab=single`, and `/methodology`.
- The contrast measurement used in phase 0, run on every panel heading in both themes.
- `eslint`, `node --test 'tests/*.test.mjs'`, and `npm run build`.

### Phase 0: bugs (done, not yet committed)

- Dark-mode panels on the country page now use surface tokens.
  Heading contrast went from 1.15:1 and 1.29:1 to 16.4:1 and 16.6:1 in dark mode, and light mode is unchanged at 8.9:1.
- The analytics map uses MapLibre's `cooperativeGestures`.
  A plain scroll wheel now scrolls the page, and ⌘ or Ctrl plus scroll zooms the map.
  On touch screens, panning the map now takes two fingers.
- `tests/dark-mode-surface-overrides.test.mjs` fails if any `bg-white/NN` utility lacks a dark override.

### Phase 1: pick a direction

Build two or three variants of the Map & Drivers view behind a hidden route with real data, then compare them side by side.

- A, atlas: full-width map, indicator rail on the left, profile panel on the right.
- B, report: CORE-style pillar strip on top, full-width map under it, profile under the map.
- C, minimal change: today's three-column layout with the cards flattened, as the baseline.

Output: a short decision note in this file and screenshots of each variant.
The route is deleted once the winner is built.

### Phase 2: foundations

This changes every page at once and is the largest visible step.

- Light by default: `src/app/layout.tsx` and `src/components/theme/theme-provider.tsx` stop reading `prefers-color-scheme`.
  The toggle and the `ldt-theme` saved choice stay.
- Tokens in `src/app/globals.css`: radius scale, one elevation token, surface and rule tokens with dark values, pillar color tokens mapped to the existing chart colors, flat background.
- A codemod script that rewrites `rounded-[...]`, `shadow-[...]`, and `bg-white/*` to the tokens across `src`, so the sweep is repeatable and reviewable as one diff.
- Delete the `!important` dark override block once no `bg-white/*` remains, and tighten the phase 0 test to forbid `bg-white/*` outright.
- Restyle `src/components/ui/button`, `card`, `tabs`, `select`, and `badge`, and add three small primitives: a section with a rule and heading, a floating panel, and a stat value.

### Phase 3: analytics workspace

- The layout chosen in phase 1.
- Indicator tree in place of the metric select, filters that apply on change.
- Map: basemap swap, labels above the data, fit and `maxBounds` per country, classed legend that filters, outlined selection.
- One shared Plotly layout for fonts, gridlines, and pillar colors in `src/components/analytics/plotly-chart.tsx`.
  The scatter loses its quadrant fills and gains a labeled selection, and a per-pillar beeswarm joins it.
- Sortable table fallback with the existing CSV export.
- AI planning brief restyled as a report in `src/components/analytics/ai-result-renderers.tsx`.
- Extra checks: a 375px mobile pass, long municipality names with `break-ui`, and a keyboard pass through the rail and the legend.

### Phase 4: country pages and home

- Pillar strip, distribution plot, and map on each country page.
- "About this data" band in place of the trust card, command center, and admin-level cards.
- Small-multiple home hero and the rewritten headline.
- Several existing tests assert copy and class names, for example `tests/country-command-center.test.mjs` checks for the text "Command center".
  Update or delete them in the same PR as the copy they check.

### Phase 5: content pages, header, footer

- Article template for About, Methodology, Roadmap, Release notes, and Resources.
- Shorter header and the moved links.

### Phase 6: optional

- Municipality profile pages at their own URLs and a rankings view, following the Capitalism Index's rankings, profiles, and compare split.

## Open decisions

1. Map tiles: OpenFreeMap now, or another option from the table.
2. Whether the background glows count as part of the color scheme.
