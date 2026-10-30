# LDT release history

The software release notes that the public Release notes page showed until 30 October 2026, kept here word for word.
The public site now has a Data updates page about the data instead; see `docs/roadmap/LDT-UI-Overhaul-Plan.md`.

## Versioning guide

- Major: Significant platform, data model, country coverage, or workflow updates.
- Minor: Focused UI/UX, analytics, content, or workflow improvements.
- Patch: Bug fixes, deployment fixes, copy corrections, and stability updates.
- Operational pre-release: Internal testing, preview deployments, and validation-only releases.

## Release v1.4.4

June 15, 2026, Minor.

This release polishes the GPB ecosystem presentation after the multi-country release, adds a Resources page for LDT and country materials, and applies reviewer-requested content corrections across the public pages.

### GPB ecosystem UI alignment

- Aligned the global header and footer with the GPB digital tools guidance, including the dark chrome treatment, GPB Suite badge, PIM-PAM footer branding, and updated LDT logo usage.
- Reordered the primary navigation to Home, About, Methodology, Resources, and Release Notes, and replaced the previous Countries header link with About.
- Applied the GPB primary palette across the app while preserving the black header and footer treatment requested for the digital tools shell.

### Resources page

- Added a Resources page to the header and footer for core LDT reference materials and country-specific workspaces.
- Linked the GPB LDT briefing, one-pager, and intro deck, plus Serbia, Zambia, and Nepal country folders with direct links to visible country documents, demos, and notebooks.
- Refined the Resources layout by removing redundant folder copy and the top-level Drive button so the page stays focused on document cards and country packs.

### Content cleanup and corrections

- Removed the homepage implemented-by strip and the methodology standardization mapping block to reduce page clutter.
- Updated About page country findings to use 161 Serbia LSGs, approximately 94% Serbia strategy coverage, approximately 97% Zambia strategy coverage, and the corrected 94% Kosovo footnote.
- Standardized GPB Suite naming across header and footer surfaces.

## Release v1.4.3

June 13, 2026, Minor.

This release prepares the Local Development Tracker for the next multi-country release by expanding Serbia and Zambia workspaces, strengthening the Strategy Inventory dashboard, improving country-aware AI planning support, refreshing GPB LDT branding/content, and hardening production deployment on Vercel.

### Multi-country workspaces

- Added live Serbia and Zambia country landing pages and analytics routes.
- Standardized Nepal, Serbia, and Zambia on the same shared country landing-page layout.
- Updated the homepage to report global workspace coverage across all loaded countries.
- Added generated analytics fallbacks and tracing so country analytics load correctly in production.

### Strategy inventory

- Added Strategy Inventory dashboards for Serbia and Zambia.
- Added Supabase-backed strategy inventory storage and ingest support.
- Added fallback and sample inventory data for preview resilience.
- Corrected Serbia coverage and readiness logic, including the 161-LSG denominator and Serbian-language AI-readiness handling.

### AI planning workflow

- Made AI planning requests country-aware for Nepal, Serbia, and Zambia.
- Updated local and SNG plan context handling while preserving existing stage compatibility.
- Improved graceful behavior when local plan URLs are missing.
- Fixed Vercel PDF parsing issues with server-side PDF.js worker and polyfill handling.

### Branding, content, and documentation

- Refreshed the About page using the GPB LDT Briefing content.
- Embedded GPB LDT figures, tables, and demo screenshots from the briefing document.
- Updated typography to Fira Sans headings and Inter body copy.
- Added the PIL diagram to the homepage and Methodology page.
- Expanded Release Notes into a more specific versioned changelog inspired by the GPBP release-notes format.

### Deployment and stability

- Bundled generated analytics JSON assets for Vercel.
- Added tracing safeguards for analytics fallbacks used by AI routes.
- Removed build-time Google font fetching from the Next.js build path.
- Added regression tests for branding/content, release notes, strategy inventory, and country-page behavior.

## Release v1.4.2

June 12, 2026, Minor.

This release moves the app beyond the original Nepal-only framing, enables Serbia and Zambia strategy inventory workflows, and fixes production deployment issues for generated analytics assets and PDF document parsing on Vercel.

### Strategy inventory workflows

- Added Strategy Inventory dashboards for Serbia and Zambia.
- Backed the strategy inventory with a new Supabase table and ingest script.
- Added Serbia and Zambia sample and fallback inventory data.
- Corrected Serbia inventory coverage and readiness logic, including treating parsed Serbian-language documents as AI-ready.

### Shared country experience

- Updated country landing pages so Nepal, Serbia, and Zambia use the same shared layout.
- Added country-aware landing actions, including the Strategy Inventory button.
- Made Development plan source availability collapsible by default.
- Updated homepage stats to summarize all loaded country workspaces instead of Nepal only.
- Removed static Nepal-only homepage framing.

### Release notes and production fixes

- Added Release v1.4 notes.
- Fixed Vercel deployment and runtime issues for generated analytics JSON files.
- Added PDF.js server-side worker and polyfill handling for Vercel AI document parsing.

## Release v1.4

June 12, 2026, Major.

This release turns the Local Development Tracker into a more complete multi-country workspace, adds Serbia and Zambia strategy inventory capabilities, and refreshes the public GPB LDT briefing content.

### Country workspaces and analytics

- Serbia and Zambia now have live country landing pages, analytics routes, generated analytics datasets, and country-specific boundary assets.
- Nepal, Serbia, and Zambia now share the same country landing-page format, including country snapshots, administrative-level summaries, SNG metrics, and plan-source availability.
- The homepage now reports global workspace coverage across all three loaded countries instead of presenting the application as Nepal-only.

### Strategy inventory dashboard

- Added Serbia and Zambia Strategy Inventory pages for tracking local strategy-document availability, publication timing, AI readiness, missing plans, and follow-up needs.
- Backed the inventory workflow with a Supabase table, ingest script, country fallback JSON, and dashboard summaries that separate LSG-level coverage from document counts.
- Corrected Serbia coverage denominators to use the expected 161 LSG universe and treated parsed Serbian-language documents as AI-ready while preserving validation blockers.

### AI planning and document context

- Made AI planning requests country-aware so Zambia and Serbia can load the correct national and local/SNG plan sources instead of defaulting to Nepal.
- Kept the existing province-plan AI stage name for compatibility while relabeling prompts and UI copy around local/SNG planning context.
- Improved graceful behavior when local plan URLs are unavailable, allowing score narratives and national-plan context to continue while blocking local-plan-dependent outputs.

### Branding, content, and documentation

- Replaced the About page with the GPB LDT Briefing content and embedded the relevant briefing figures, country demo panels, strategy screenshots, and tables.
- Updated the app typography to use Fira Sans for headings and Inter for body text, with appropriate fallback fonts.
- Added the PIL diagram to the homepage and Methodology page to make the Prosperity, Infrastructure, and Livability framework more visible.

### Deployment and stability fixes

- Bundled generated analytics JSON files so Serbia and Zambia analytics pages load correctly on Vercel.
- Added server-side PDF.js worker handling and polyfills so AI document parsing works in Vercel functions.
- Removed build-time Google font fetching from the Next.js build path and added tracing safeguards for generated analytics assets used by AI routes.

## Release v1.3

May 21, 2026, Minor.

This release introduced the multi-country portal shell and prepared the app for country-specific landing pages beyond Nepal.

### Portal and navigation

- Reworked the homepage into a country portal with selector-based entry points for supported countries.
- Simplified header branding, navigation, and supporting page shells to match the multi-country product structure.
- Added under-construction handling for country routes that were not ready for public analytics yet.

### Country pages and theming

- Tightened country landing-page copy and CTAs so each country page emphasizes analytics access and local context.
- Added persistent dark mode across the app with themed charts, improved tooltip contrast, and hydration-safe initialization.
- Adjusted country page positioning and shared page components so future countries can reuse the same layout patterns.

## Release v1.2

May 21, 2026, Minor.

This release refined the AI planning brief workflow and made analytics outputs easier to inspect and interpret.

### AI workflow refinements

- Improved web-context output so users see clearer summaries and source lists instead of dense per-source cards.
- Made planning-alignment bullets denser and more directly tied to the selected score theme and planning evidence.
- Expanded recommendation cards with clearer implementation-risk sections and more usable structured outputs.

### Score interpretation

- Updated Step 1 AI analysis charts to plot 0-100 component scores instead of raw indicator values.
- Fixed chart ranges to match score semantics so prosperity, livability, and infrastructure comparisons are easier to read.
- Shortened AI tab labels and helper text to reduce cognitive load during the staged analysis workflow.

## Release v1.1

May 20, 2026, Major.

This release added the first staged AI Planning Brief workflow on top of the municipality analytics surface.

### AI Planning Brief

- Added staged AI routes for indicator narrative, local plan context, national plan context, web context, planning alignment, SWOT analysis, and investment recommendations.
- Wired document parsing and AI-stage caching into Supabase-backed server routes so repeated municipality analyses can reuse prior context.
- Added structured renderers for alignment, SWOT, recommendations, and web-context outputs on the analytics route.

### Supporting content

- Aligned Release Notes, Methodology, and About pages with the expanded analytics-plus-AI product direction.
- Improved AI result cards so outputs are easier to scan, compare, and validate against source evidence.

## Release v1.0

May 18, 2026, Major.

This release established the public Local Development Tracker analytics application.

### Core analytics

- Restored the reference-style application structure with Home, Methodology, Release Notes, and About pages.
- Added interactive Plotly 2D and 3D scatterplots with hover, zoom, click selection, and axis labels.
- Shipped the MapLibre choropleth view as the default municipality map experience.

### Data foundation

- Completed Supabase-backed score, component, municipality context, and analytics query layers for the public app.
- Connected score-driver charts, indicator metadata, and municipality summaries to the runtime analytics dataset.
