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
| Map tiles: OpenFreeMap | 2026-10-29 | Positron in light mode and Dark in dark mode, with English labels drawn above the data. See [Map tiles](#map-tiles). |
| Analytics layout: atlas, plus two parts of the report | 2026-10-29 | Phase 3 builds the atlas. The report's ranking table goes under the atlas map, and its pillar strip leads the country page in phase 4. See [Phase 1 result](#phase-1-result-2026-10-29). |
| Planning brief: precomputed, reviewed, five fixed sections | 2026-10-29 | A new phase before phase 4 rebuilds the AI planning brief. See [Planning brief, before phase 4](#planning-brief-before-phase-4). |
| Pages outside the workspace follow [Public data tool page patterns](../../reports/Public%20data%20tool%20page%20patterns.md) | 2026-10-30 | No public roadmap; its content moves to the repository docs. Release notes become a Data updates page about the data, not the software. Country pages gain a data-as-of line, CSV and print, change since the last comparable year, and ranks within the country. The page plans below are updated to match. |

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
| Global Capitalism Index (UVA) | Rankings, profiles, and compare as the three top-level views. Users can pin countries for comparison. This plan first recorded a delta "since 2024" on every ranked row; a fetch on 2026-10-30 showed only rank, name, and score, so that is unconfirmed. |
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
| Surfaces | The existing names, made opaque: `--surface`, `--surface-strong` for raised panels, `--surface-muted` for wells, and `--border-soft` and `--border-strong` as rules, each with a dark value | `bg-white/70` to `/94` plus `!important` dark overrides |
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

Revised 2026-10-30 from the page patterns report, which found the UNDP and EPI country pages open with a dated line and download actions, then the score with its band, rank, and change, then components, trend, and peers.

- A header with the country, the unit count, a "Data as of" line naming the edition and data year, and two actions: download the scores as CSV, and print.
- A pillar strip: each pillar's national median, its change since the last year whose data coverage compares (or a note saying the years don't compare), and every unit as a tick.
- A full-width map of the units, colored by the chosen pillar, each unit linking into the workspace.
- For each pillar, the five highest and five lowest units with their ranks within the country, linking to the full ranking.
- Plain links into the workspace: Map, Compare, Planning briefs.
- An "About this data" band at the bottom with the edition, the years, the sources, the caveats, and links to Methodology and Data updates, in place of the trust card, command center, and admin-level cards.

### Home (`/`)

- Lead with the three countries as small-multiple maps colored by one pillar, with a headline that names what is measured and where (built 2026-10-30).
- Next, per the report: one number per country beside its map, and a way to the data from the first screen.

### Content pages

- One article template (built 2026-10-30).
- About: a short About plus a user guide, with the QuickStart note kept under Resources (built 2026-10-30).
- Methodology: indicator table and CSV, what changes between years, and the corrected missing-value wording with a dated change note (built 2026-10-30).
- Resources: now Data and documents, with the downloads first (built 2026-10-30); a license line waits on Son.
- Data updates replaces Release notes: dated entries about the data (which country and year, what was added or corrected, whether years compare), known data issues, and the release history kept in the repository docs.
- No public roadmap page; the roadmap content lives in `docs/roadmap/`.

### Header and footer

- Header: logo, country menu, four content links, theme toggle, and the GPB Suite mark (built 2026-10-30).
- Footer: built 2026-10-30; contact and license wait on Son.

## Delivery order

Every phase ends with the same checks, so the sequence proves itself to a reviewer:

- Before and after screenshots of five URLs in light and dark: `/`, `/nepal`, `/nepal/analytics?tab=multi`, `/nepal/analytics?tab=single`, and `/methodology`.
- The contrast measurement used in phase 0, run on every panel heading in both themes.
- `eslint`, `node --test 'tests/*.test.mjs'`, and `npm run build`.

### Phase 0: bugs (done)

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

#### Phase 1 result, 2026-10-29

Status: decided on 2026-10-29. Son picked A, atlas, with B's pillar strip and ranking table.

The route is `/nepal/analytics/prototypes?v=atlas`, `?v=report`, or `?v=minimal`, and keys 1, 2 and 3 switch between them.
Production builds return 404 for it unless `LDT_PROTOTYPES=1` is set.
All three variants share one map component on OpenFreeMap, five quantile classes in the active pillar's color, and a legend that filters the map on click.

Screenshots at 1440x900 in both themes and at 375px wide are in [phase-1](phase-1/).
The report and minimal shots are full-page.

| Variant | What works | What doesn't |
| --- | --- | --- |
| A, atlas | The map fills the screen. At 1440x900 one screen holds the indicator tree, the map, the unit's three scores with rank and distribution, and its drivers. It is the closest of the three to the CVI. | The floating panels cover nearly half the map's width at 1440px, and more between 1024px and 1280px. Each panel collapses to give the map back. On a phone the profile ends up under the full indicator list. |
| B, report | The pillar strip is the best single element in the three builds. The beeswarm and the ranking table answer "where does this unit stand" better than the atlas's tick strips, and every row carries a delta. | The map starts about 660px down the page, below the fold on a 900px screen. It reads as a page about one unit, not a tool for scanning the country. |
| C, minimal | The tokens alone remove the glows, the stacked cards, and the pill buttons. | It still looks like a dashboard template, with a sidebar of selects and chart blocks stacked under a heading. The drivers section runs about 1,600px. |

Decision: build A for the analytics workspace in phase 3 and take two parts from B.

- B's pillar strip leads the country page in phase 4, as the country page plan already proposes.
- B's ranking table goes under the atlas map in phase 3 as the sortable, accessible fallback.

C shows that the phase 2 tokens are necessary and not sufficient on their own.

Found while building, for phase 3:

- The data has three unit counts: 806 units with scores, 759 in the coverage count, and 751 boundary features. The pillar strip ranks against 806 and the ranking table against 751, so Bhaktapur is 567th in one and 538th in the other. Pick one denominator for everything users see.
- Indicator labels carry their unit inside the name, for example "Nighttime Luminosity (unit: nWatts/(cm2 x sr))". The prototypes split it with `splitUnit` in `derive.ts`. The data should carry the unit as its own field.
- OpenFreeMap's Dark sprite has no `circle-11` image for city dots, so the map draws its own.

### Phase 2: foundations

This changes every page at once and is the largest visible step.

- Light by default: `src/app/layout.tsx` and `src/components/theme/theme-provider.tsx` stop reading `prefers-color-scheme`.
  The toggle and the `ldt-theme` saved choice stay.
- Tokens in `src/app/globals.css`: radius scale, one elevation token, surface and rule tokens with dark values, pillar color tokens mapped to the existing chart colors, flat background.
- A codemod script that rewrites `rounded-[...]`, `shadow-[...]`, and `bg-white/*` to the tokens across `src`, so the sweep is repeatable and reviewable as one diff.
- Delete the `!important` dark override block once no `bg-white/*` remains, and tighten the phase 0 test to forbid `bg-white/*` outright.
- Restyle `src/components/ui/button`, `card`, `tabs`, `select`, and `badge`, and add three small primitives: a section with a rule and heading, a floating panel, and a stat value.

#### Phase 2 result, 2026-10-29

Status: built and uncommitted in the `mosaic-liv` clone, branch `ui-overhaul`.

- The site opens light unless the visitor saved dark. Checked in headless Chrome with the OS set to dark: no saved choice opens light, a saved dark choice opens dark.
- `globals.css` has the 4px and 6px radius scale, opaque surfaces in both themes, one `--elevation` token as `shadow-float`, pillar color tokens, and a flat page background. The glow, wash, and `!important` dark override blocks are gone.
- `scripts/codemods/phase-2-surfaces.mjs` rewrote 149 radii, 55 shadows, 91 `bg-white` uses, 8 gradient washes, 34 pill shapes, and 4 hover lifts across 32 files. A second run changes nothing, and `--check` exits 1 if anything is left to rewrite.
- `tests/surface-tokens.test.mjs` replaces the phase 0 test. It forbids `bg-white` in `src` and fails when the codemod would rewrite anything. Both tests failed on a planted `bg-white/80` with a `1.5rem` radius and passed without it.
- The primitives in `src/components/ui` are restyled with their exported names and variants unchanged, and `section.tsx`, `panel.tsx`, and `stat.tsx` are new.

Changes the plan did not list:

- The token names stay as they were instead of `--surface-raised` and `--rule`. Renaming 216 border uses would have changed nothing on screen.
- `a { color: inherit }` sat outside any CSS layer in `globals.css`, so it beat every Tailwind text color on a link. It now sits in the base layer. That bug is why "Analyze municipality metrics" had navy text on blue at 1.87:1 in light mode.
- White text on `--accent` and `--primary` fills failed in dark mode, where those fills turn light: 2.22:1 on the same button. Ten fills now use the paired `--accent-foreground` or `--primary-foreground`, at 4.79:1 light and 7.86:1 dark.
- The header's theme and menu buttons are transparent on the dark chrome, and the GPB and PIM-PAM logo plates use a new `--gpb-chrome-plate` that stays white in both themes.

Checks: every heading and filled control on the five URLs measures at least 4.5:1 in both themes, with 4.54:1 the lowest. No page logs a console error or scrolls sideways at 1440px. 76 tests pass, `eslint` is clean, and `npm run build` succeeds.

Left for the page phases: 111 uppercase eyebrows, cards nested inside cards, colored stat tiles in the analytics summary, and the rounded waterfall bars.

### Phase 3: analytics workspace

- The atlas layout from phase 1: full-bleed map, indicator tree on the left, the unit's profile on the right, both panels collapsible.
- Indicator tree in place of the metric select, filters that apply on change.
- Map: basemap swap, labels above the data, fit and `maxBounds` per country, classed legend that filters, outlined selection.
- One shared Plotly layout for fonts, gridlines, and pillar colors in `src/components/analytics/plotly-chart.tsx`.
  The scatter loses its quadrant fills and gains a labeled selection, and a per-pillar beeswarm joins it.
- The report prototype's ranking table under the map as the sortable fallback, with the existing CSV export.
- AI planning brief restyled as a report in `src/components/analytics/ai-result-renderers.tsx`.
- Extra checks: a 375px mobile pass, long municipality names with `break-ui`, and a keyboard pass through the rail and the legend.

#### Phase 3 result, 2026-10-29

Status: built and uncommitted in the `mosaic-liv` clone, branch `ui-overhaul`, for Son to test locally.

- `/[country]/analytics` now opens on the map instead of Compare.
  The `tab` values and every other URL parameter are unchanged.
- A workspace bar under the header holds the country, year, and unit count, links to Map, Compare, and Planning brief, and year and province selects that apply on change.
- The map view is the phase 1 atlas on production tokens.
  The indicator list and legend float on the left, search and the unit's profile on the right, and both panels collapse.
  On phones the map comes first, then the legend, the profile, and the indicator list.
- The map keeps panning and zoom-out near each country, refits when a province is picked or the window resizes, and keeps Cmd or Ctrl plus scroll for zoom.
  The legend filters by class with a mouse or a keyboard.
- A sortable ranking table with CSV export sits under the map.
  It lists every unit in the year and province filter, marking units without a boundary as "Not on map".
- Compare shows a beeswarm per pillar first, then the 2D scatter without quadrant fills and with the selected unit labeled, then the 3D chart.
  Axis selects apply on change, and the charts share one Plotly layout from `plotly-chart.tsx`.
- The planning brief reads as a report: numbered sections, a progress list, plain tables, numbered source notes, and run details in a disclosure.
  Nothing runs on load.
- The loading and error states match the new layout.
- Eight components that only the old page used are deleted, along with the OpenStreetMap raster style.

Fixed from the phase 1 list:

- Every rank counts the same set: units in the current year and province filter that have a value, with or without a boundary.
  Bhaktapur is 538th of 751 on prosperity in the profile, the beeswarm, and the table, after the boundary guard below.
- Every metric carries `name` and `unit` fields, split from the label on the server.

Changes the plan did not list:

- New text tokens `--ink` and `--ink-muted` and delta tokens `--delta-above` and `--delta-below`, used by the new views.
  `--foreground` stays navy, so older pages change only in their own phases.
- Phase 2's buttons, selects, tabs, and badges drew no keyboard focus outline.
  In Tailwind v4, `outline-none` and `outline-hidden` both set `--tw-outline-style: none`, which `focus-visible:outline-2` reads.
  Each now adds `focus-visible:outline-solid`, and a focused button measures a solid 2px outline.
- Smooth scrolling now respects reduced motion.
- `Section` heads use `--ink`, and descriptions wrap instead of being cut to one line.

Checks: every head and filled control on the five URLs measures at least 4.5:1 in both themes, with 6.17:1 the lowest, on the map view.
No page logs a console error or scrolls sideways at 1440px or 375px.
112 tests pass, 36 of them new, covering ranking, unit splitting, the swarm layout, legend number formats, and citation notes.
`tsc` and `eslint` are clean, and `npm run build` succeeds.

Open after phase 3:

- Road Flood Risk is labelled "%" but its values reach 2.5 million, and Change in Forest Area reaches 28,000.
  Both need a check at the source.
- Nepal's generated data says 20 units have no boundary, but all 751 units in that file have one.
- The prototype route and `src/components/prototypes` still exist, uncommitted, for comparison.
- Nepal's live data has 806 units, but 55 of them are boundary slivers with their own, often extreme, scores.
  Since 2026-10-29 the analytics pages count, rank, and average only units with a boundary (751 in Nepal) and list the 55 in a note under the ranking table.
  `node scripts/check-unit-boundaries.mjs` lists them and exits 1 while any remain; 8 of the 55 have a row in Supabase's `municipality_boundaries` table but no feature in the app's boundary file.
  The source fix is still open.
- The base `h5` style is an uppercase, letter-spaced eyebrow; phases 4 and 5 remove eyebrows.
- The planning brief takes about 6.5 seconds to render in dev; its data path did not change in this phase.

### Planning brief, before phase 4

Added on 2026-10-29 at Son's request.
The research and the settled decisions are in [Planning brief LLM redesign](../../reports/Planning%20brief%20LLM%20redesign.md), with its notes in `research_notes/Planning brief LLM redesign/`.

The brief becomes a precomputed, reviewed document per unit and data release, built on a fact sheet the code computes.
It has five fixed sections: position and drivers, plan commitments with page quotes, coverage gaps, options to investigate, and open questions for the municipality.
The SWOT and the per-stage buttons go, and web search moves into an analyst-only data assistant.
Every brief is reviewed before it is public; until then, the public sees only the parts the code writes.

Order of work:

- Two follow-ups to phase 3 come first, both done on 2026-10-29: rank bands in the map profile and beeswarm ("Fourth fifth · 538th of 751", from the legend's own classes), and a guard against Nepal's 55 sliver units with a data check script.
- Then the report's phases 0 to 6: pipeline fixes and a plan inventory, the fact sheet, batch generation with review, the plan store, options, evaluation, and the data assistant.

#### Planning brief Phase 0 result, 2026-10-30

Status: built and uncommitted; one paid smoke call made, see below.

Pipeline:

- The default model is `gpt-5.6-luna`.
  Each stage sends a reasoning effort (low for the prose stages, medium for alignment and recommendations) and an output token budget; older models get temperature 0 instead.
  Calls time out after 120 seconds, and a response cut off by its token budget is an error, not a partial brief.
- Every run records token usage and an estimated cost in `ai_stage_runs`, priced at $0.20 input, $0.02 cached input, and $1.20 output per million tokens; an unknown model gets no cost.
- Plan passages, web results, and earlier stage outputs reach the model inside `<document>` tags, and the system prompt says instructions inside them are not followed.
  The prompt version moved from v2 to v3, and cache keys hash the prompt text, so results from older prompts can't be reused.
- The national plan context is cached once per country, score theme, release, model, and prompt version, instead of once per municipality.
- Showing stored briefs on page load moved to Phase 2: the public may not see unreviewed AI text, and the app has no sign-in yet.
- Checked live on 2026-10-30 with one `indicator_narrative` regenerate call for Bhaktapur (run `96db06bd`).
  The API accepted the request: HTTP 200 in 20 seconds, model `gpt-5.6-luna`, prompt v3.
  The row stores `reasoning.effort` low, `max_output_tokens` 5000 and no temperature.
  Usage came back as 585 input, 495 output and 109 reasoning tokens, at an estimated $0.000711.
- `.env.local` pinned `AI_PROMPT_VERSION=v1` as well as `OPENAI_MODEL`, which mislabelled every run after a prompt change.
  Son removed both lines on 2026-10-30, and a cached load with no overrides returned the v4 `gpt-5.6-luna` run, so local runs now follow the code defaults.
  Vercel still needs the same two variables removed, in the deploy that ships this branch and not before: the deployed code sends no reasoning effort or token budget, and its cache lookups would stop matching the stored `gpt-4.1-mini` briefs.

Audit, with outputs in `data/ai-audit/` (outside git):

- The run store holds 36 completed runs, not the 100 planned: three units (Beograd-Barajevo, Chibombo, Bhaktapur), the prosperity theme only, prompt v1, `gpt-4.1-mini`.
  `labels-20261030.csv` lists them with empty label columns for Son's team and four automatic hints.
- Plan documents, per unique URL:

| Country | URLs | Downloaded | PDF with text | Scanned PDF | Not a PDF | Failed |
| --- | --- | --- | --- | --- | --- | --- |
| Nepal | 10 | 2 | 2 | 0 | 0 | 8 |
| Zambia | 111 | 110 | 107 | 3 | 0 | 1 |
| Serbia | 135 | 77 | 63 | 1 | 13 | 58 |

- Zambia's plans are almost all machine-readable English, so OCR matters for 3 documents.
- Serbia's downloaded plans are text PDFs, 54 of them in Cyrillic.
  Its problem is the 58 that failed (29 TLS resets, 20 timeouts, four 403s, three 404s, one DNS failure, one expired certificate); they need a rerun from another network before they count as dead.
- Nepal has no usable plans.
  Six of its seven "province plan" rows link to capacity and partnership mapping reports, not development plans, and they failed to download from here.
  Gandaki's link to its real five-year plan returns 404, and the national plan link drops the connection.
  The two documents that did download are a tourism master plan and a crop investment plan.
- `hand-check-20261030.csv` picks 30 documents for Son's team: all 10 for Nepal, and 10 each for Zambia and Serbia across text, scanned, and failed.

Defects found and left for the phases that rewrite this code:

- Web-context citations such as "Hit 1, Hit 2" stay unresolved, because the resolver splits on semicolons only.
- Two Nepal document parses threw `The "path" argument must be of type string` and fell back to Exa.
- Word and zip files would be read as HTML.
- Two stored contexts point at a local file path or an old `supabase://` path.
- The Chipili link redirects from http to an https gov.zm host and fails the relaxed-TLS rule, which checks only the original URL.

Defects the smoke call exposed, fixed on 2026-10-30:

- The smoke narrative said Bhaktapur had no 2025 scores for four of its five prosperity components, yet Supabase has all five (100, 13, 13, 100, 2).
  `selectAllRows` in `src/lib/data/queries.ts` paged with `.range()` and no `.order()`, and Postgres does not keep row order stable between unordered pages.
  Five releases loaded at once, as `buildAiIndicatorSeries` does, lost up to 4,339 of 14,508 component rows per release; one attempt lost all of Bhaktapur's.
  Component values page in all three countries and score values in Nepal (2,418 rows); indicator and context values fit in one page today.
  Fix: all four queries now order by `municipality_id` and their score, indicator, or component id, and the helper's comment says every caller must.
  Check: the AI tab loaded Bhaktapur's five 2025 values correctly five times in a row, and the map pages for three Nepal pillars returned identical rankings across five loads each.
  Those rankings match an independent ordered read ranked with `rankUnits`: 751 units, prosperity median 52.8, Bhaktapur 538th, 38th, and 28th of 751 for prosperity, livability, and infrastructure.
  So the sliver-guard figures still hold.
- `formatSeries` in `src/lib/ai/prompts.ts` labelled the unit's own value "Latest {plan unit} score".
  Nepal takes plans from provinces, so the prompt called Bhaktapur's value a province score, and the model reported it as Bagmati's.
  Fix: the lines now read "Latest score for Bhaktapur" and "Latest average for units in Bagmati".
  `tests/ai-narrative-prompt.test.mjs` fails on the old wording and passes on the new; the prompt version moved to v4.
- A second smoke call after both fixes (run `9f229a3e`, prompt v4, $0.000777) used all five values, credited them to Bhaktapur, and compared them with Bagmati and national averages.
  The first run's averages also moved (built area 28.42 and 46.20 became 28.09 and 45.55), so they too came from incomplete rows.
  Run `96db06bd` keeps the wrong v3 text in `ai_stage_runs`; no v4 lookup can match it.

Next: Son's team labels the 36 runs and hand-checks the 30 plans, failed downloads get a rerun from another network, and Nepal needs real development plans before its brief can have plan sections.
Phase 1, the fact sheet and section one, depends on none of these.

#### Planning brief Phase 1 result, 2026-10-30

Status: built and uncommitted. Nothing is served yet; Phase 2 puts section one on the page.

Decisions Son made on 30 October 2026:

- A raw 0 means "not recorded" for health and school access, tourism sites, broadband and mobile speed, and both emissions measures.
  Railway and road risks are "not applicable" where the unit has none of the asset, and "not recorded" in years whose asset lengths were never computed.
  These components show with a note but never count as drivers, trends, or neighbour dimensions.
- Only `zod` is added now; `ai` and `@ai-sdk/openai` wait for the Phase 6 assistant, so live calls and Phase 2's batch calls share one request path.
- Only the golden set's fact sheets are checked in (3.1 MB); every unit's sheet would be about 65 MB.
- Up to $1 of generation for the golden set; $0.39 was spent.

What the data showed:

- The score pipeline turns a raw 0 into a fixed score, and many of those zeros are missing data.
  In 2021 every Nepal unit shows 0% health access and 0 tourism sites, and 682 of 751 show zero emissions.
  Bhaktapur's prosperity "rose" from 34.4 to 45.6 because its tourism data first appears in 2025; the fact sheet now calls that change not comparable.
- Road and railway lengths, and the road and railway risks, are 0 for every unit in all three countries from 2021 to 2024: they were computed for 2025 only.
  So no unit's livability change can be stated, and 51 Serbian livability "changes" from an earlier draft of the builder were artifacts.
- The share of schools and hospitals without broadband is exactly 0 or 100 for 704 of 751 Nepal units, and 546 of those have no recorded speed.
  It now counts only where broadband speed was recorded. This rule is a judgement call for Son's team to review.
- Component averages include the fixed values of units with nothing recorded.
  Tourism is measured for 234 of 751 Nepal units, so section one says when a driver's national average mostly reflects fixed values.

What was built, in `src/lib/brief/`:

- `availability.ts`: the status of each component (measured, not recorded, not applicable, missing).
- `facts.ts`: the fact builder, pure TypeScript over `src/generated/*/analytics-data.json`, which matches Supabase and has the 751 boundary units.
  About 330 facts per unit: pillar scores, national and province averages and gaps, bands from the map legend's classes (province bands only where the province has 20 or more units, so Nepal only), yearly history, change from the first year with the same coverage against a "broadly stable" threshold (the median year-to-year movement, 3.6 points for Nepal's prosperity), component values, averages, gaps, contributions, statuses, drivers, coverage counts, and the three nearest neighbours on measured components, population, and land area.
  `FACT_SHEET_VERSION` is 2.
- `section-one.ts`: the code-only text, each sentence built from parts bound to fact ids.
- `prompt.ts`: the strict JSON schema from `zod`, the system prompt, and the parser; prompt version `section-one-v2`.
- `verify.ts`: the verifier.
  Every number must equal a cited fact at the precision shown, direction and band words must agree with cited facts, superlatives need a driver, band, or neighbour fact, unrecorded components cannot be compared, named components must be cited, and ranks and spelled-out numbers fail.
- Band helpers moved from `src/lib/analytics/derive.ts` to `ranking.ts`, which imports nothing, so the map and the brief share one rule; `derive.ts` re-exports them.
- `openai-request.ts` accepts a JSON schema format alongside plain text.
- `GLOSSARY.md` defines the terms.

Checks:

- `tests/fixtures/brief/golden-set.json` lists 45 units, 15 per country, each with the reasons it was picked: pillar extremes, largest rises and falls, the most and fewest unrecorded components, the median unit, units with and without a readable plan, the three Phase 0 units, and typical units for uncovered higher units.
  `scripts/build-brief-golden-set.mjs` rebuilds it.
- `tests/brief-facts.test.mjs` and `tests/brief-verify.test.mjs` add 20 tests: contributions add up to the gap for every unit, only measured components become drivers, Bhaktapur's false rise stays not comparable, uncomputed asset years count as not recorded, bands match the map, fixtures match rebuilt sheets, all 21,101 templated sentences across the three countries pass the verifier, and one test per way a model sentence could misstate a fact.
- `scripts/generate-brief-section-one.mjs` ran the golden set twice on `gpt-5.6-luna`, each call capped against the spend limit:

| Run | Calls completed | Sentences kept | Cost |
| --- | --- | --- | --- |
| Prompt v1, fact sheet v1 | 134 of 135 | 707 of 729 (97.0%) | $0.175 |
| Prompt v2, fact sheet v2 | 135 of 135 | 888 of 900 (98.7%) | $0.209 |

- v1 dropped sentences for counts the model worked out ("these 2 components"), component gaps that had no fact yet, and an uncited 2025; v2 added component gap facts, let the edition year go uncited, and raised the limit to 8 sentences.
  v2's 12 drops are all correct: 9 self-made counts, 2 "broadly stable" changes described as a decrease, and 1 invented fact id.
- A separate check found no kept sentence that attaches a number to the wrong component, across 766 component-number pairs.
- `scripts/render-brief-review.mjs` writes `data/brief-review/section-one-20261030-v2.html` (outside git): per unit and pillar, the code-only text beside the model draft, with dropped sentences, reasons, and cited facts.

Open for later phases:

- The model draft added little to the code-only text; it mostly rephrased it.
  Son decided on 30 October 2026 that section one stays code-only for good (decision 13 in the redesign report): no model draft, no review queue.
  The section one prompt and the generation and review scripts stay as the evidence for that decision and as the pattern for the model-written sections in Phase 3; nothing serves them.
- The model keeps stating counts of the items it lists; a count fact per driver list would make those sentences citable.
- The not-recorded rules and the key-structures rule need Son's team to confirm them against the source pipeline, and the score pipeline should stop giving unmeasured components a score.
- The verifier cannot yet tell which number in "X and Y, at a against b and c against d respectively" belongs to which component.

#### Planning brief Phase 2 plan, decided 2026-10-30

Section one is code-only (decision 13), so no model-written section exists until Phase 3.
Phase 2 therefore serves only what code produces; the section store, batch generation, analyst sign-in, and the review console move to Phase 3.

Son's decisions:

- The brief is a Brief tab in the analytics workspace, replacing the AI tab, with the unit in the URL (`?tab=brief&municipality=...`) and a print stylesheet.
- The old button-gated stages go: the seven buttons, the seven `/api/ai` routes, and the code that runs them.
  The run store, its cache, and the export stay.
  Removing them also closes a gap: today any visitor can click the tab's `load_cached` calls, which need no token, and read unreviewed model text.
  The admin regenerate for one unit returns in Phase 6.

Work:

1. Fact sheets come from the data the map reads: an ordered Supabase query shaped like the generated dataset, falling back to the generated file, cached per country and release.
   A check script builds both and confirms they give identical sheets.
2. The Brief tab: a header with the status ("Generated from the data by code, no model text"), the data edition, the fact sheet version, and a methodology link; section one for each pillar with every number bound to its fact id; the unit's plan documents, each marked "not yet read" until Phase 3; sections two to five marked "not yet available"; and a footer on bands rather than ranks.
3. Remove the old stages and the code only they use.
4. End-to-end checks in headless Chrome: the numbers match the fact sheet, no `/api/ai` request on load, light and dark themes, 375 px wide, and print.

#### Planning brief Phase 2 result, 2026-10-30

Status: built and uncommitted.

One change from the plan: fact sheets come from the generated analytics files, not from Supabase.
`scripts/check-brief-data.mjs` compared every score, component, indicator, and context value for every unit with a boundary and every year in all three countries, and found no difference beyond Supabase rounding population to whole people.
Reading the files saves about 165,000 Supabase rows per country each time a server starts, and production already bundles them for the analytics route.
Rerun the check after every data release, after `npm run build:data`.

What was built:

- The Brief tab (`?tab=brief`; old `?tab=ai` links land on it) shows the status line, the data edition and fact sheet version, section one for each pillar in prose paragraphs with every number bound to its fact id (its description on hover), the unit's local and national plan documents marked as listed but not yet read, the four later sections as in preparation, and closing notes on bands and fixed values.
- Print and Markdown download; both keep the status line, the edition, and the closing notes. Printing hides the site header and footer, the workspace bar, the search, and the buttons.
- `src/lib/brief/brief-data.ts` builds one unit's sheet on request from a per-country builder kept in memory, so a server never holds every sheet.
  `src/lib/brief/document.ts` holds the brief's fixed text and the Markdown export, shared by the page and the download.
- Removed: the seven `/api/ai` routes and `_utils.ts`, the pipeline, the OpenAI and Exa clients, the request validator, the old export, the stage prompts, the AI tab and its three renderers, the AI page data in `queries.ts`, five unused AI types, the AI stage evidence badge, and the routes' tracing entries in `next.config.ts`.
  The `<document>` wrapping and its rules moved to `src/lib/ai/source-documents.ts` for Phase 3.
  The run store, its cache, the citation resolver, and the plan ingestion code (`documents.ts`, `plan-document-fetch.ts`, `pdf-worker.ts`) stay.
- `AI_GENERATION_ENABLED` and `AI_ADMIN_TOKEN` are no longer read by anything.

Checks:

- 146 tests pass, including `tests/brief-export.test.mjs`; tests that only covered deleted code went with it.
  `tsc`, `eslint`, and the production build are clean, and the build lists no `/api/ai` route.
- Headless Chrome, Bhaktapur, Chibombo, and Beograd-Barajevo: 117, 121, and 137 fact-bound numbers, none different from the fact sheet; the status line on every brief; no `/api/ai` request and no console error in light or dark; no sideways scroll at 1440 or 375 px; `?tab=ai` opens the Planning brief tab; print hides the site chrome; `POST /api/ai/indicator-narrative` returns 404.

#### Planning brief Phase 3a result, 2026-10-30

Status: built and uncommitted; nothing is served yet.

Son's decisions on 30 October 2026:

- Phase 3 splits in two.
  3a builds the plan store as local files, extracts commitments for the golden set, and renders sections two and three on a review page.
  3b follows Son's review of 3a: the tables as migrations on a Supabase branch, batch runs over every plan, analyst sign-in, the review console, and serving.
- Extraction reads every readable page in chunks of 25, not pages picked by theme keywords; the whole corpus costs about $5 that way.
- Up to $3 for 3a; $1.96 was spent across a trial and three golden-set runs.

The plan store (`scripts/build-plan-store.mjs`, written to `data/plan-store/`, outside git):

| Country | Plans | Text | Needs OCR | Not a PDF | Failed | Readable pages | Empty or garbled pages |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nepal | 10 | 2 | 0 | 0 | 8 | 280 | 3 |
| Zambia | 111 | 107 | 3 | 0 | 1 | 21,939 | 1,744 |
| Serbia | 135 | 66 | 2 | 9 | 58 | 6,027 | 299 |

- One record per plan URL, with the units it covers: Belgrade's city plan covers 17 municipalities, and Mambwe and Mufumbwe share one URL, which looks like a workbook error.
- Pages carry their PDF page numbers, so a quote's link opens the right page; the number printed on a page often differs.
- Pages flagged garbled are mostly title pages and tables of contents; extraction skips them and empty pages.

Extraction (`src/lib/plans/extract.ts`, `scripts/extract-plan-commitments.mjs`), golden set's 20 local plans plus the Zambian and Serbian national plans:

| Run | Zambia match rate | Serbia match rate | Commitments kept | Components per commitment | Silent plan-component cells | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| v2 | 90.5% | 93.1% | 2,099 | 1.42 | 108 of 360 | $0.62 |
| v3 | 93.0% | 95.6% | 2,444 | 1.43 | 98 of 360 | $0.66 |
| v4 | 95.7% | 95.9% | 2,302 | 1.14 | 128 of 360 | $0.65 |

- The match rate is the share of quotes found word for word in the plan; v2 and v3 also counted too-short items, which v4 reports apart.
  v3 asked for one item per quote and table rows whole; v4 added a page-break fix in the matcher and a rule to map each commitment to the one component it directly changes, which cut emissions mappings from 329 to 210 and found 30 more silent cells.
- The 99 percent target is not met: about 4 percent of quotes are paraphrased or joined and are dropped, so they cost recall but never reach the brief.
- Quotes stay in the plan's language; Serbian ones carry an English line labelled machine translation.

Sections two and three (`src/lib/brief/plan-sections.ts`): section two lists each pillar's verified commitments with a link to their page; section three sets each component's position against the national average (more than 10 points either side counts as above or below) against how much the plan says about it (high, medium, low, silent), and names every below-average component with what the plan says, in sentences the section one verifier checks.
`scripts/render-plan-review.mjs` writes `data/plan-store/commitments-20261030-v4.html` for review.

Tests: `tests/plan-text.test.mjs` (page parsing, page quality, quote matching across line breaks, split words, quote styles, and page breaks, and quotes that must fail) and `tests/plan-sections.test.mjs` (unrecorded components are never gaps, salience, page links, and verified gap sentences); 158 tests pass.

Data defects for Son's team: the source descriptions of Road Heatwave, Road Flood, and Railway Heatwave are swapped, and Mambwe and Mufumbwe share a plan URL.

Before 3b, Son's team should read the review page and judge two things the code cannot: whether the commitments are the ones a planner would pick, and whether each maps to the right component.

#### Planning brief Phase 3b, in progress (2026-10-30)

Son's decisions on 30 October 2026:

- The tables go on a Supabase branch, `brief-3b` (`izzywqmnaamehiqtunqf`, $0.01344 an hour), holding only 3b's migration.
  Production's migration history records only 2 of the repo's 12 migrations, so the branch's own startup reports `MIGRATIONS_FAILED`; the brief tables stand alone and do not need the others.
  Delete the branch once 3b reaches production.
- Son is the only admin; everyone else is a public reader (decision 14 in the report).
  The review console runs only under `next dev` on Son's machine, and a deployed build answers 404 for it.
  This replaced the first build's emailed sign-in links, analyst list, and roles, which were removed the same day along with `src/proxy.ts`, `/sign-in`, `/auth/confirm`, and the `@supabase/ssr` upgrade.
- Batch extraction of every remaining plan, up to $5.
- Son decides each commitment (accept, reject, or correct its components), then marks each score reviewed or withheld.

Built so far:

- `supabase/migrations/0013_brief_plan_store_and_review.sql`: six `public.brief_*` tables (plan documents, pages, extraction runs, commitments, commitment reviews, unit reviews), with row-level security on and no policies, so only the server's service role reads or writes them.
  Applied to the branch.
- `scripts/batch-extract-commitments.mjs` ran the 153 plans not in the golden-set run as three OpenAI batches: 1,068 chunks, none failed, $2.24 at half the live price.
  `collect` verified every quote as the live runs do: 16,737 commitments kept, and a 95.2% quote match rate (Zambia 95.0%, Serbia 95.6%, Nepal's two plans 98.8%), in line with 3a.
  Two Serbian plans, Irig and Žabalj, gave no commitments and need a look.
- `scripts/load-brief-store.mjs` loads the plan store and runs into the branch; it refuses to write without `BRIEF_SUPABASE_*`, so it never touches production.
  Loaded on 30 October 2026: 256 plan documents, 29,605 pages, and four runs (the golden set's v4 run and the three batches) holding 19,039 commitments from 171 of the 175 readable plans.
- The branch copied the main project's API settings, which expose an `analytics` schema the branch never had, so its API refused every request (PGRST002) until an empty `analytics` schema was created on the branch.
  That fix is branch-only and not part of migration 0013, since production already has the real schema.
- Review console: `/review` (the queue, golden set first) and `/review/[country]/[unit]` (per score: commitments with accept, reject, and component corrections; the drafted coverage table and gap sentences; mark reviewed or withheld, with the content hash computed on the server).
  Its pages and actions check `reviewConsoleEnabled()` in `src/lib/brief/supabase.ts`.
- Bulk accept (Son, 30 October 2026): each score has "Accept all undecided", which accepts with the model's components every commitment the page listed as undecided and that is still undecided.
  The write inserts and skips existing rows, so a rejection or correction, even one made in another tab after the page loaded, is never overwritten.
  The intended order is to reject or correct the bad ones, accept the rest in one click, then mark the score reviewed.
- Serving: the Brief tab shows sections two and three per score only when reviewed and unchanged since; everyone else sees "In review".
  The status line and the Markdown export follow the same rules and give the review date.
- The golden set's list moved to `src/lib/brief/golden-set.json`, since the review queue orders by it.
- 165 tests pass, including `tests/brief-review.test.mjs`; `eslint` and the production build are clean.
  On a production server `/review`, a unit's review page, `/sign-in`, and `/auth/confirm` return 404 and the Brief tab returns 200.

End-to-end check on 30 October 2026, on Kalomo's Prosperity score (30 commitments), against the branch:
- A rejection and a component correction made in the console were stored as made.
- A rejection written straight to the database after the page loaded, standing in for another tab, survived "Accept all undecided", which accepted the other 27.
- Mark reviewed stayed disabled until nothing was undecided, then stored the review with its content hash.
- The public Brief tab, in dev and in a production build, showed Prosperity's sections with "Reviewed on 30 October 2026", without the rejected quotes and with the correction applied; Infrastructure and Livability stayed "In review".
  The production build answered 404 for both console pages.
- The test decisions and review were deleted afterwards, so the branch holds no decisions.

That check found symbol-font bullets (Wingdings U+F0FC and other private-use characters) inside 432 of the 19,039 quotes, which browsers draw as empty boxes; `displayQuote` now shows them as "•", with a test in `tests/plan-sections.test.mjs` (166 tests pass).
Bulk accept also lets through mappings worth a second look: in Kalomo it accepted a list of health-facility works under Luminosity per Area, so read a score's commitments before accepting the rest.

Next: Son reviews, starting with the golden set at `/review` on the local dev server.

#### Planning brief visual redesign (2026-10-30)

Son found the brief too text-heavy, so the page now leads with charts and keeps the sentences one click away.
A screenshot of Kalomo with one score reviewed is in [brief-redesign](brief-redesign/kalomo-brief-light.png).

- A strip of the three scores opens the brief: value, gap to the national average, band, and every unit as a tick with the national and province averages marked.
- Each score has its own section: a dot chart of every component against both averages, with a bar showing the gap; a column of the plan's commitments per component once the score is reviewed, flagging a below-average component the plan never mentions; a sparkline over the years, dashed when the years don't compare; and the three similar units as bars.
- Not-recorded components show as a dashed row that says the score counts a fixed value, instead of a sentence about them.
- The plan's quotes come one per component, with the rest behind "N more quoted".
- Section one's sentences sit behind "Read as text" on screen and always print; the Markdown export keeps them all.
- The six repeated "In review" lines became one line per score, and the "Later sections" placeholders and the stale "Listed, not yet read" note are gone from the page and the export.
- The charts are server-rendered SVG in `src/components/analytics/brief/brief-charts.tsx`, fed by `visuals` in `BriefData`, which `getBriefData` reads from the full fact sheet; `createFactSheetBuilder` gained `scores(scoreId)` so the strips count the same units as the sheets.
- Checked at 1440px in light and dark and at 375px; 166 tests, `tsc`, `eslint`, and the production build pass.

### Phase 4: country pages and home

- Pillar strip, distribution plot, and map on each country page.
- "About this data" band in place of the trust card, command center, and admin-level cards.
- Small-multiple home hero and the rewritten headline.
- Several existing tests assert copy and class names, for example `tests/country-command-center.test.mjs` checks for the text "Command center".
  Update or delete them in the same PR as the copy they check.

### Phase 5: content pages, header, footer

- Article template for About, Methodology, Roadmap, Release notes, and Resources.
- Shorter header and the moved links.

#### Phase 4 home and phase 5 content pages, result (2026-10-30)

Son asked for both after the brief redesign, because the pages outside the country workspace still read as generated.
The country pages and the header and footer are not done yet.

- `src/components/layout/article.tsx` is the one template: a sentence-case kicker, one Fira title size, Inter at 17px on a 68-character measure, rules between sections, numbered steps in the margin, titled entries under short rules, plain figures, and a sticky "On this page" list on long pages.
- About, Methodology, Resources, Roadmap, and Release notes use it, with their wording kept as written apart from headings: no cards, no spaced-capital labels, and body text in `--ink` instead of the navy and blue that made every page read blue.
- Roadmap shows the versions as a dated list under a small timeline of the sprint windows; its stat tiles, icons, colored tones, and the "Roadmap page slice" block, which listed the steps for building the page itself, are gone.
- Release notes is a dated list with the release type as text; the versioning guide is a four-column key.
- Home leads with the three countries as small-multiple maps, drawn on the server as SVG from the local boundary files (`src/lib/maps/outline.ts`: flat projection, Ramer-Douglas-Peucker, relative path commands) and colored by fifths within each country for the pillar picked in three radio buttons.
  The headline names what is measured and where, and the stat tiles, the select box, the four-card grid, and the framework PNG are gone; the PNG stays on Methodology.
  The built page is 84 KB gzipped.
- Tests: `tests/home-page-global.test.mjs` now checks the headline count and that every boundary file draws a full map; `tests/branding-content.test.mjs` no longer checks the removed home diagram or the "Country resource spaces" label.
- Checked at 1440px in light and dark and at 375px; 168 tests, `eslint`, and the production build pass.

Content for Son to decide, left as written:

- The About note, dated 23 May 2026, still describes the SWOT and AI investment recommendations, with their screenshots, which the app has since dropped.
- Methodology says missing component values are skipped in aggregation, but the Phase 1 data check found the score pipeline counts a fixed value for them, as the brief says.
- The roadmap's sprint dates run to 31 October 2026, so most read as past.

#### Country pages and Data updates, result (2026-10-30)

Built from the page patterns report after Son approved folding it into the plan.

- Country pages (`src/components/country/country-landing-page.tsx`) open with the country, its unit count, population, and area, a "Data as of" line (the date the edition was generated, 15 June 2026), Download CSV, and Print, then the workspace links.
- A strip gives each pillar's national median with every unit as a tick, and the median change since the previous year over the units whose components were recorded the same way in both years, using the fact-sheet builder's new `countryChange`, so the country page and the brief share one rule.
  The change shows only when at least half the units compare: Nepal Prosperity (517 of 751) and Zambia Prosperity (60 of 116); every other pillar says which components were recorded differently.
- A full-width map colored by the chosen pillar opens a unit in the workspace on click (one handler, not a link per unit), then the five highest and lowest units per pillar with their ranks, then "About this data" with the edition, coverage, boundary, and local-plan facts from the trust model (its AI readiness item removed), caveats, the country context, the admin levels, and the sources.
- `/api/countries/[country]/scores` serves every unit's pillar and component scores for every year as CSV, prerendered per country.
- The command center, trust card, context panel, the unit table loaded on the client, and the `sng-metrics` and `plan-availability` routes it used are gone, with their tests.
- `/data-updates` replaces Roadmap and Release notes: current editions, a table of how many units compare per country and pillar, known data issues, and dated data updates.
  `/roadmap` and `/release-notes` redirect there; their content is in `docs/roadmap/product-roadmap.md` and `docs/release-history.md`, and `tests/release-notes.test.mjs` now checks that file.
- The header is Home, About, Methodology, Resources, Data updates; the footer drops the dead "Country workspaces" anchor.
- Weight: Nepal's page is 172 KB gzipped, mostly its 751 map paths, which Next sends twice; Zambia 61 KB, Serbia 74 KB; repeat requests take about 0.3 s with the map and summaries cached per server.
- 166 tests, `eslint`, and the production build pass; checked in light and dark at 1440px and at 375px.

Open for Son:

- Component scores may be rescaled within each year (agricultural land spans about 0 to 100 every year); if so, every year-to-year change, on the country page and in the brief, measures relative position, which the data team should confirm.
- The country context copy in `src/lib/countries.ts` still mentions AI-assisted plan context.

#### About and Methodology, result (2026-10-30)

Son approved splitting About and extending Methodology from the page patterns report.

- About (`/about`) is short: why the LDT exists (the QuickStart note's own paragraphs), what it does, who built it and who funded it (from the note), how to cite an edition, and links onward.
  The unit count, the component count, and the citation example's edition and data date come from the data.
- The QuickStart note moved word for word to `/resources/quickstart`, with a dated editor's note saying the LDT no longer has the AI narratives, SWOT analysis, and investment recommendations it describes; `tests/branding-content.test.mjs` follows it there.
- A new user guide (`/resources/user-guide`) walks through the home page, country pages, the map, Compare, planning briefs, downloads, and how to read the scores, with screenshots of Kalomo taken from a production build (`images/user-guide/`).
- Resources lists both under a new Guides group.
- Methodology (`src/lib/indicators.ts`) adds a table of all 19 indicators per pillar: what each measures, the component it feeds, which direction scores higher, the years with recorded values, and linked sources, plus `/api/indicators` as a CSV of the same.
  Seven indicators are recorded only for 2025 (hospital and school access, tourism points of interest, and the four road and railway hazards); a new section says so and points to Data updates.
  The score calculation now says unrecorded components count a fixed value, and a dated "Changes to this page" entry records the correction; a test guards against the old wording.
- The table shows corrected descriptions for Road Flood, Road Heatwave, and Railway Heatwave, marked as corrected; the first two reuse the source's own wording, the railway heatwave one follows the same pattern. Son, who is the data team, confirmed all three on 2026-10-30; the source metadata and the map's indicator panel still carry the swapped text.
- 167 tests, `eslint`, and the production build pass; all six pages are static.

#### Data page, result (2026-10-30)

- Resources is now "Data and documents" (`/resources`, labelled Data in the header and footer, so links and the guides under it keep their paths).
- It opens with the downloads, each with its format, real size, edition, and data date, measured from the files this build serves: a scores CSV per country (one row per unit and year), the indicator list as CSV, and each country's boundaries as GeoJSON.
- Then a short "Using the data" note (cite the edition and date, see Methodology for sources and Data updates for comparability), the guides, the core LDT materials, and the country materials.
- `src/lib/downloads.ts` builds both CSVs for their routes and for the page's sizes, so a size on the page is the size of the file served; the Zambia CSV came out byte for byte the same after the move.
- 168 tests, `eslint`, and the production build pass; the page is static.

Open for Son: the page has no license line, because the LDT's terms of use are not stated anywhere in the app or its documents.

#### Footer, result (2026-10-30)

- The footer opens with what the LDT measures (the unit count and countries come from the release metadata), then who built it and who funded it, from the QuickStart note.
- Two short link groups under plain headings replace the spaced-capital "Explore" and "Countries": "The data" (Get the data, Data updates, Methodology, How to cite) and the three countries; the header's own links are not repeated.
- The GPB Suite and PIM-PAM marks sit in a row below a rule; the PIM-PAM plate needed an explicit width once it left the old column layout.
- 168 tests, `eslint`, and the production build pass; checked at 1440px in both themes and at 375px, with the logos confirmed loaded in a browser.

Open for Son: no contact address or license is stated anywhere in the app or its documents, so the footer has neither.

#### Header, result (2026-10-30)

- The header now runs: logo (home), a country menu, then About, Methodology, Data, and Data updates; the Home link went, since the logo already links home.
- The country menu (`src/components/layout/country-switcher.tsx`) is Base UI's menu with link items, so arrow keys, type-ahead, and Escape work and each country opens in a new tab like any link.
  It shows the current country inside a country's pages, and switching from a map, compare, or brief view opens the same view in the other country, keeping the tab and metric and dropping unit and province.
  From anywhere else, including Serbia's and Zambia's strategy inventories, it opens the country page, since Nepal has no inventory; `tests/country-switcher.test.mjs` covers those cases.
- The mobile menu lists the countries first, with the same targets, and the language label no longer shares a line with the GPB Suite mark.
- Checked in a browser at 1280px with the keyboard (Enter, arrow keys, Enter took Nepal's brief to Zambia's), in dark mode, and at 375px in headless Chrome; 171 tests, `eslint`, and the production build pass.

Found while checking and fixed the same day: the strategy inventory pages laid out 714px wide on a 375px phone, so phones zoomed out to fit.
The follow-up list was a grid with no column template, so its one implicit column grew to the longest unbroken URL in a card's notes; it now uses `grid-cols-1` (minmax(0, 1fr)) with `overflow-wrap: anywhere` on the cards, and Serbia and Zambia measure 375px under phone emulation with nothing past the edge.

Not fixed at the time: those notes showed raw pipeline errors (for example "URL request failed or did not return a PDF" with a Python exception) and source links tagged `utm_source=chatgpt.com`, which come from the strategy inventory data; and the inventory pages still had the pre-overhaul look and copy about SWOT and AI-ready analysis.
Both were fixed the same day; see "Strategy inventory, result".

#### Strategy inventory, result (2026-10-30)

- Serbia's and Zambia's strategy inventories now use the country page's layout.
  In order: a link back to the country, three totals, a status bar that says what each status means, a year-published chart, the table, and a note on how the inventory was made.
- The three totals are units with a plan link, linked documents whose text was read, and plans whose stated years include the year of the check (2026).
- The year chart is plain HTML bars instead of Plotly, with empty years kept so the spacing is honest, and the page no longer loads Plotly.
- The pipeline labels are gone from the page.
  "AI-ready", "Found / Not Parsed", "Needs Translation", "Needs Validation", and "Missing" read "Text read", "Not yet read", "Needs translation", "Needs a check", and "No document".
  Each status has a dot, and a missing document gets an empty ring, so color is never the only cue.
- The table has four columns (unit, years, status, document), a search box, one toggle per status with its count, and sorting by name, years, or status.
  On phones the years and the link fold under the unit name, so the table needs no sideways scroll.
- The page never prints a record's notes.
  `src/lib/strategy-inventory/public.ts` maps each note to one fixed sentence or to nothing: a failed download, a PDF with no text layer, a regional document, a document that does not name the unit, or an unclear scope.
  A passing automatic check shows no note, so the model's assessment of the document and its quoted evidence never reach the page.
- The server builds the table's rows, so the notes are not in the page payload either.
  A search of the served HTML for both countries found none of the error text, auto-check fields, model evidence, or `utm_` parameters.
- Links drop `utm_*` parameters, and search no longer matches the hidden notes.
  The old filter module (`src/lib/strategy-inventory/filters.ts`) went with the old table, since nothing else used it.
- Checked: 185 tests pass (15 new in `tests/strategy-inventory-public.test.mjs`, one per failure mode), and so do `tsc`, `eslint`, and the production build.
  Screenshots at 1440px in both themes are in `docs/roadmap/strategy-inventory/`, and at 375px nothing reaches past the edge.
  Search, the status toggles, sorting, and Show all were exercised in a browser against the production build.

Open for Son:
- The statuses come from one automatic pass on 11 June 2026 that nobody has checked by hand, and the page says so.
  82 of Serbia's 161 municipalities need a check; 59 of those are links that timed out or did not return a PDF, which a rerun of the link check may clear.
- Serbian local names in the inventory are the Latin names, so a search in Cyrillic finds only document titles.

#### Merge of GitHub's v1.5, result (2026-10-31)

`origin/v1.5` (8f7929c, 48 commits from 11 to 23 October) is merged into `ui-overhaul` as a local merge commit and is not pushed.
The dry run found 14 conflicts.

What came in:
- Paging in `src/lib/data/queries.ts` orders by unique keys, the same fix this branch had made; v1.5's explicit form is kept.
- Release membership (`src/lib/data/release-membership.ts`): when the selected release matches the bundled data's release, only the bundled data's units for that year are kept.
- Map coverage counts boundary features that have geometry, not rows in Supabase's boundary table.
- The comparison CSV comes from `buildComparisonCsv` in `src/lib/csv.ts`, which labels the axes "X:" and "Y:" when both are the same metric.
- The Zambia plan fetch pins the Sectigo intermediate certificate.
- The process-wide cache of plan document sources in `src/lib/ai/documents.ts` is gone, so changes to that table show up without a restart.
- `npm test` runs every test with v1.5's loader hook; `LOCAL_SETUP.md` and `.env.sample` describe local setup.
- Serbia's area is no longer hard-coded at 312,717 km², which is Poland's area; the country page already derives it from the data.

What stayed out:
- The AI stage files this branch deleted stay deleted, along with v1.5's fixes to them and five tests that only cover them.
- v1.5's form keys on the old analytics page fix stale `defaultValue` selects; the new workspace has no uncontrolled inputs, so the bug cannot occur.
- `LOCAL_SETUP.md`, `.env.sample`, the tracing config, and `scripts/verify-country-api-tracing.mjs` now describe this branch's routes and env vars.
  The web app makes no model calls, so the Exa key and the generation flags are gone from both files.

Decisions made in the merge:
- Units are filtered in two layers: v1.5's release membership first, then this branch's boundary guard, which now uses v1.5's geometry check.
  On live data the result is unchanged: Nepal counts 751 units, Bhaktapur is 538th, 28th, and 38th of 751, and the note lists the 55 slivers.
  The guard still matters for a release the bundled data does not know, such as a future Nepal release built the same way, where membership keeps every unit.
  Two of v1.5's tests expected such a release to rank a unit with no boundary; they now expect it in the note instead.
- The note under the ranking lists every unit with scores in the release that is left out, whichever filter dropped it.
  Without that, v1.5's membership filter removed Nepal's 55 slivers before the guard saw them, and the note disappeared.
- Serbian readiness follows v1.5, with Son's agreement: a plan the data marks as needing translation is not ready, in Serbian or not.
  Serbia now shows 1 of 151 linked documents ready and 68 needing translation, against 68 and 1 before.
  "Text read" became "Ready to use", since 68 plans whose text was read are not ready; the about note says translation is required.
- The inventory page names expected units that have no inventory row at all, and skips the table when a country has no rows, as Zambia's sample does.
  Live data has no such units today.

Checked: `npm test` and `node --test tests/*.test.mjs` both run 203 tests, 202 passing and one skipped (v1.5's opt-in live TLS test).
`tsc`, `eslint`, the surfaces check, the production build, and the tracing script pass.
Against the production build, the analytics pages for all three countries and both inventory pages return 200, nothing overflows at 375px, and the inventory HTML has no notes, auto-check fields, or `utm_` parameters.

### Phase 6: optional

- Municipality profile pages at their own URLs and a rankings view, following the Capitalism Index's rankings, profiles, and compare split.

## Open decisions

1. Whether the background glows count as part of the color scheme.
