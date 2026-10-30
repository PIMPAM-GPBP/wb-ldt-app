# Current LDT planning brief pipeline (codebase study)

Repository: `/Users/sonle/Documents/work/mosaic-liv`, branch `ui-overhaul`, read on 2026-10-29.
All paths below are relative to the repository root.
Line numbers refer to the working tree.
The AI library under `src/lib/ai/` and the routes under `src/app/api/ai/` are committed and unchanged against HEAD; the three brief UI files and `src/lib/data/queries.ts` carry uncommitted edits, and `src/components/analytics/ai-citations.ts` is untracked (output of `git status --porcelain`, this session).
No paid call, pipeline run, or Supabase query was made for this study; every statement about live data (which rows exist in Supabase, what a cached plan passage looks like) is marked as a gap.

## Q1. End-to-end map of the pipeline

### Takeaway
Seven server stages, each its own POST route, share one `runAiStage` switch; four stages call OpenAI `gpt-4.1-mini` through a raw `fetch` to the Responses API with no parameters other than the model, two stages parse plan documents without a model, and one stage calls Exa and then the model. Every stage rebuilds the whole analytics page context before doing anything, and outputs are free text that the browser parses with regular expressions.

### Cited Findings

Stage registry and routes
- The seven stage names are `indicator_narrative`, `province_plan_context`, `national_plan_context`, `web_context_search`, `plan_alignment`, `swot_analysis`, `investment_recommendations` — [src/lib/ai/types.ts:4-14](src/lib/ai/types.ts).
- One route directory per stage under `src/app/api/ai/`, each a 20-line `POST` that validates the payload, calls `runAiStage(<stage>, payload)`, and returns JSON; each declares `runtime = "nodejs"` and `maxDuration = 300` — [src/app/api/ai/indicator-narrative/route.ts:1-20](src/app/api/ai/indicator-narrative/route.ts), [src/app/api/ai/plan-alignment/route.ts:1-20](src/app/api/ai/plan-alignment/route.ts).
- Payload validation accepts only `countryCode` in {NPL, ZMB, SRB}, `releaseKey`, numeric `year`, `municipalityId`, `scoreId`, and `mode` in {generate, regenerate, load_cached} — [src/lib/ai/request.ts:3-32](src/lib/ai/request.ts).
- In production, any mode other than `load_cached` is refused with 403 unless `AI_GENERATION_ENABLED` is `"true"` or the request carries `AI_ADMIN_TOKEN` as a bearer or `x-ai-admin-token` header; outside production everything is allowed — [src/app/api/ai/_utils.ts:6-27, 78-88](src/app/api/ai/_utils.ts).
- `runAiStage` first calls `getAiPipelineContextForRequest`, which calls the full `getAnalyticsPageData(..., tab: "ai")` loader, then switches on stage — [src/lib/ai/pipeline.ts:1194-1225](src/lib/ai/pipeline.ts), [src/lib/data/queries.ts:1272-1330](src/lib/data/queries.ts).
- The pipeline context carries country, release key, year, municipality (id, name, district, province), score (id, label), `indicatorSeries`, `waterfalls`, `provincePlanCandidates`, `localPlanUnitName`, `localPlanUnitLabel`, `localPlanAvailable` — [src/lib/ai/types.ts:161-185](src/lib/ai/types.ts).

Model client
- Model name is `process.env.OPENAI_MODEL ?? "gpt-4.1-mini"` — [src/lib/ai/openai.ts:3-5](src/lib/ai/openai.ts).
- The request to `https://api.openai.com/v1/responses` sends only `model` and a two-message `input` (system, user); no `temperature`, `max_output_tokens`, `text.format`, `stream`, or timeout is set — [src/lib/ai/openai.ts:62-81](src/lib/ai/openai.ts).
- The response is flattened by a recursive `collectText` that concatenates any `output_text`, `text`, `content`, `output`, and `summary` fields; the only validation is that the joined text is non-empty — [src/lib/ai/openai.ts:7-45, 88-93](src/lib/ai/openai.ts).
- No OpenAI or Exa SDK is a dependency; `pdf-parse` 2.4.5 (on `pdfjs-dist` 5.4.296) is the only document library — [package.json:16-36](package.json); versions read from `node_modules/*/package.json` this session.

Shared system prompt
- One system prompt for all model stages: English only, three score themes, no dimensions, plain text with headings, no markdown emphasis, no empty bullets, and "Cite evidence in-line at the end of each bullet using the format [Sources: ...]" — [src/lib/ai/prompts.ts:29-40](src/lib/ai/prompts.ts).

Stage 1: `indicator_narrative`
- Input: for each score component, label, description, and the latest year's municipality value, higher-admin average, and national average (earlier years are dropped by `formatSeries`) — [src/lib/ai/prompts.ts:3-16, 42-56](src/lib/ai/prompts.ts).
- Instruction: a concise narrative on the selected score, which indicators strengthen or weaken the unit, and "Do not use any local/SNG plan or national plan context in this stage" — [src/lib/ai/prompts.ts:52-54](src/lib/ai/prompts.ts).
- No output format is prescribed beyond the system prompt; the renderer looks for headings matching `/strengthening/i` and `/weakening/i` and an "Overall summary" line — [src/components/analytics/ai-result-renderers.tsx:90-146, 808-818](src/components/analytics/ai-result-renderers.tsx).
- Cache input: municipality, score, the full `indicatorSeries`, and an `evidence` array of per-indicator points — [src/lib/ai/pipeline.ts:413-434](src/lib/ai/pipeline.ts).
- Structured output stored is only `{ municipality, score }`; the single source reference is `{ label: "<score> indicator series", type: "indicator_series", source: "supabase" }` — [src/lib/ai/pipeline.ts:450-467](src/lib/ai/pipeline.ts).
- `indicatorSeries` is built per score component from `municipality_score_component_values` for every release year, with province average over same-province units and national average over all units — [src/lib/data/queries.ts:628-686](src/lib/data/queries.ts).
- UI: a "Latest component values" table and one Plotly line chart per component, then the narrative split into Summary, Strengthening, Weakening, other sections — [src/components/analytics/ai-analytics-tab.tsx:584-625](src/components/analytics/ai-analytics-tab.tsx), [src/components/analytics/ai-result-renderers.tsx:797-870](src/components/analytics/ai-result-renderers.tsx).

Stage 2a: `national_plan_context` (no model)
- Model name recorded as the constant `"document-parser"` — [src/lib/ai/pipeline.ts:38, 618-691](src/lib/ai/pipeline.ts).
- Sources are the `plan_level = 'national'` rows of `analytics.plan_document_sources` for the country, filtered to rows whose `score_theme` is null or matches the score prefix (prosperity, infrastructure, livability) — [src/lib/ai/documents.ts:99-115, 198-224](src/lib/ai/documents.ts).
- All matching documents are fetched and parsed in parallel, concatenated with `Document N:` headers, fingerprinted, and stored once per country in `ai_document_contexts` under a synthetic `supabase://analytics.plan_document_sources/<country>/national/<hash>` path — [src/lib/ai/documents.ts:248-370](src/lib/ai/documents.ts).
- Stage output: `renderedOutput` is a preview of the first 12 passages (or 12,000 characters) and `structuredOutput` is the whole document context including `extractedText` — [src/lib/ai/pipeline.ts:40-68](src/lib/ai/pipeline.ts).
- The stage cache is scoped by municipality and score even though the document is country-level, so each unit re-caches the same text — [src/lib/ai/pipeline.ts:239-272](src/lib/ai/pipeline.ts), [src/lib/ai/cache.ts:198-250](src/lib/ai/cache.ts).

Stage 2b: `province_plan_context` (no model, Exa fallback)
- The chosen plan is the lowest-priority-number candidate for `localPlanUnitName` — [src/lib/ai/pipeline.ts:274-276](src/lib/ai/pipeline.ts).
- Direct fetch and parse; on any error, `tryExtractWithExa(chosen.link)` (Exa `/contents`) is attempted and, if it returns text, saved with `provider: "exa_fallback"` — [src/lib/ai/pipeline.ts:472-559](src/lib/ai/pipeline.ts), [src/lib/ai/exa.ts:12-59](src/lib/ai/exa.ts).
- Cache input for this stage is only the selected URL and candidate metadata, not the document content — [src/lib/ai/pipeline.ts:565-585](src/lib/ai/pipeline.ts).

Stage 2c: `plan_alignment`
- Loads the latest completed `province_plan_context` and `national_plan_context` cache rows for the scope and the latest `web_context_search` row; fails with a message if either plan context is missing or lacks `sourceUrlOrPath` — [src/lib/ai/pipeline.ts:819-843](src/lib/ai/pipeline.ts).
- Prompt: first 10 passages of each document (`Passage N: ...`), the optional web summary, and a fixed structure: Alignment summary, Strongest areas of alignment, Most important gaps or tensions, Implications for local planning; 4 to 6 bullets each, each ending in `[Sources: Local/SNG plan; National plan]` or the same plus `Web context` — [src/lib/ai/prompts.ts:18-23, 58-95](src/lib/ai/prompts.ts).
- Cache input includes both document fingerprints and the web summary text — [src/lib/ai/pipeline.ts:870-890](src/lib/ai/pipeline.ts).
- UI: a "Plan documents" block with a 300-character excerpt and a "Show full extracted text" disclosure per plan, then the four groups — [src/components/analytics/ai-analytics-tab.tsx:191-263, 627-683](src/components/analytics/ai-analytics-tab.tsx), [src/components/analytics/ai-result-renderers.tsx:243-314, 910-937](src/components/analytics/ai-result-renderers.tsx).

Stage 3: `web_context_search`
- Query: `"<localPlanUnitName>" "<country>" local development plan "<municipality>" "<unit label>" "<score label>" public investment priorities` — [src/lib/ai/pipeline.ts:120-127](src/lib/ai/pipeline.ts).
- Exa `/search` with `type: "auto"`, `numResults: 5`, then `/contents` with `text: true` for every returned URL; hits with empty text are dropped; no domain, date, or language filter — [src/lib/ai/exa.ts:69-167](src/lib/ai/exa.ts).
- Exa failure or zero hits produces a completed stage whose output says no web context was injected and whose `structuredOutput.skipped` is true — [src/lib/ai/pipeline.ts:746-784](src/lib/ai/pipeline.ts).
- The model summarises up to 2,500 characters per hit under Key takeaways, Policy signals, Implementation risks, Why this matters locally — [src/lib/ai/prompts.ts:212-250](src/lib/ai/prompts.ts).
- Stored snippets are cut to 1,800 characters; each hit becomes a `web_search` source reference with `publishedDate` and `searchScore` — [src/lib/ai/pipeline.ts:129-151, 803-811](src/lib/ai/pipeline.ts).

Stage 4: `swot_analysis`
- Requires a completed `indicator_narrative` with text plus both plan contexts; it does not require `plan_alignment` — [src/lib/ai/pipeline.ts:949-986](src/lib/ai/pipeline.ts).
- Prompt: the narrative text, the same first-10 passages of each plan, the optional web summary; exactly 3 bullets per SWOT quadrant, 0 to 2 under Missing information, every bullet ending in `[Sources: ...]` — [src/lib/ai/prompts.ts:97-146](src/lib/ai/prompts.ts).
- Cache input includes the narrative text itself, so regenerating the narrative changes the SWOT cache key — [src/lib/ai/pipeline.ts:995-1021](src/lib/ai/pipeline.ts).

Stage 5: `investment_recommendations`
- Requires completed narrative, alignment, and SWOT text — [src/lib/ai/pipeline.ts:1086-1099](src/lib/ai/pipeline.ts).
- Prompt: the three earlier outputs plus optional web summary, and a fixed template of exactly 3 ranked recommendations with Project Description, Data-Based Justification, Plan-Based Justification, Implementation Risks, Implementation Actions — [src/lib/ai/prompts.ts:148-210](src/lib/ai/prompts.ts).
- Source references are the three earlier stages (`type: "generated"`) plus any web references; no plan or data reference is attached directly — [src/lib/ai/pipeline.ts:1169-1186](src/lib/ai/pipeline.ts).
- The renderer splits the text on `^\d+\.` blocks and regex-matches the five labelled sections — [src/components/analytics/ai-result-renderers.tsx:447-471](src/components/analytics/ai-result-renderers.tsx).

Caching and run store
- Cache contract: `inputHash` = stable hash of the stage input, `sourceFingerprint` = hash of `input.evidence` (or other evidence-like fields), `promptHash` = hash of system and user prompt, `modelSettingsHash`, and `cacheKey` = hash of scope (country, stage, release, year, municipality, province, score, model, prompt version, invalidation version) plus the four hashes — [src/lib/ai/run-store.ts:66-107](src/lib/ai/run-store.ts).
- `runWithAiStageCache`: `generate` returns a cache hit when a completed row with the same `cacheKey` exists; `load_cached` returns a failure on miss without generating; `regenerate` skips the lookup; every generation (success or failure) is persisted as a run — [src/lib/ai/run-store.ts:151-203](src/lib/ai/run-store.ts).
- Persistence writes one `ai_stage_runs` row per attempt and upserts `ai_stage_cache` only for completed runs, keyed on the scope columns plus `input_fingerprint` (which is the `cacheKey`) — [src/lib/ai/pipeline.ts:303-360](src/lib/ai/pipeline.ts), [src/lib/ai/cache.ts:198-301](src/lib/ai/cache.ts).
- Downstream stages read dependencies with `loadLatestAiStageCacheByScope`, which takes the most recently updated completed row for the scope and invalidation version regardless of model name, prompt version, or cache key — [src/lib/ai/cache.ts:138-196](src/lib/ai/cache.ts), [src/lib/ai/pipeline.ts:693-703](src/lib/ai/pipeline.ts).
- `ai_stage_runs` has `token_usage` and `estimated_cost_usd` columns, but `saveAiStageRun` never writes them — [supabase/migrations/0012_ai_run_store.sql:7-44](supabase/migrations/0012_ai_run_store.sql), [src/lib/ai/cache.ts:252-301](src/lib/ai/cache.ts).
- Prompt version defaults to `"v2"` (`AI_PROMPT_VERSION`), invalidation version to `"v1"` (`AI_INVALIDATION_VERSION`) — [src/lib/ai/cache.ts:15, 26-32](src/lib/ai/cache.ts).
- Tables are service-role only after RLS hardening; the server client uses `SUPABASE_SERVICE_ROLE_KEY` — [supabase/migrations/0008_harden_ai_access.sql:1-10](supabase/migrations/0008_harden_ai_access.sql), [src/lib/supabase/server.ts:17-31](src/lib/supabase/server.ts).

Client, export, and citations
- The tab keeps `stageResults` in React state seeded from `ai.cachedStages`, posts to the route map, and maps non-OK responses to a failed payload — [src/components/analytics/ai-analytics-tab.tsx:32-40, 265-334](src/components/analytics/ai-analytics-tab.tsx).
- "Download brief" builds a Markdown file with run id, cache key, fingerprints, prompt version, model, and the raw output per stage — [src/lib/ai/export.ts:27-90](src/lib/ai/export.ts), [src/components/analytics/ai-analytics-tab.tsx:350-382](src/components/analytics/ai-analytics-tab.tsx).
- Citations: source references become numbered notes; `[Sources: A; B]` markers are split and each label is matched to notes by regex rules (`Hit N`, exact title, web words, stage words, data words, national, local or SNG); unmatched labels stay visible in parentheses — [src/components/analytics/ai-citations.ts:98-147, 162-218, 244-273](src/components/analytics/ai-citations.ts), [src/components/analytics/ai-result-renderers.tsx:494-562](src/components/analytics/ai-result-renderers.tsx).
- Run details (status, cache label, model, prompt version, run id, cache key, source fingerprint, updated) sit in a disclosure under each card — [src/components/analytics/ai-stage-card.tsx:35-75, 121-132](src/components/analytics/ai-stage-card.tsx).

### Inferences
- The three stages that read plans all see the same 10 passages, so the "alignment", "SWOT", and "recommendations" differ only in instructions, not in evidence; the SWOT and recommendations are mostly rewrites of earlier model text.
- The `waterfalls` carried in the context (contribution deltas per component) are never used by any prompt, so the score-driver arithmetic the app already computes does not reach the model.
- Because `loadLatestAiStageCacheByScope` ignores prompt version and model, a later stage can be built on an input generated under an older prompt or a different `OPENAI_MODEL`.

### Gaps
- Model output lengths and the real token counts are not recorded anywhere, so every size figure in Q6 is an estimate from the prompt builders.
- I could not confirm which `plan_document_sources` rows are active in Supabase, only what the ingest workbook would produce.

## Q2. Why each later stage is gated; data dependency versus UI choice

### Takeaway
Only three gates are true data dependencies (alignment needs both plan contexts; SWOT needs the narrative and both plan contexts; recommendations need narrative, alignment, and SWOT). The step-1 and national-plan buttons, the SWOT-waits-for-alignment rule, and the "web context must run first to count" ordering are UI choices.

### Cited Findings
- Server-side dependency checks: alignment needs both plan context rows — [src/lib/ai/pipeline.ts:824-843](src/lib/ai/pipeline.ts); SWOT needs the narrative and both plan contexts, not alignment — [src/lib/ai/pipeline.ts:950-967](src/lib/ai/pipeline.ts); recommendations need narrative, alignment, SWOT — [src/lib/ai/pipeline.ts:1086-1099](src/lib/ai/pipeline.ts).
- The narrative stage has no dependency and is told to ignore plans — [src/lib/ai/prompts.ts:42-56](src/lib/ai/prompts.ts).
- The UI blocks SWOT on both the narrative and the alignment, and blocks recommendations on those plus SWOT; both are also blocked when no local plan is on file — [src/components/analytics/ai-analytics-tab.tsx:460-469, 699-739](src/components/analytics/ai-analytics-tab.tsx).
- The "Generate alignment" button runs national context, then local context, then alignment sequentially, stopping on failure or when no local plan exists — [src/components/analytics/ai-analytics-tab.tsx:406-422](src/components/analytics/ai-analytics-tab.tsx).
- Web context is optional; later stages include it only if a completed row with hits exists at the moment they run, and its text is part of their cache input, so running web context afterwards does not update them — [src/lib/ai/pipeline.ts:153-169, 828, 870-875, 959, 1091](src/lib/ai/pipeline.ts).
- The progress list labels steps Complete, Running, Failed, Blocked, Optional, Ready — [src/components/analytics/ai-analytics-tab.tsx:384-404, 471-511](src/components/analytics/ai-analytics-tab.tsx).
- Buttons exist because each stage is a separate POST with a 300-second budget and generation is gated in production — [src/app/api/ai/_utils.ts:78-88](src/app/api/ai/_utils.ts), [src/app/api/ai/swot-analysis/route.ts:6-7](src/app/api/ai/swot-analysis/route.ts).

### Inferences
- The true dependency graph is: narrative, national context, local context, web context all independent; alignment after the two contexts; SWOT after narrative and contexts; recommendations after narrative, alignment, SWOT. A server orchestrator could run the first four in parallel and finish the chain in three model rounds.
- The SWOT-on-alignment UI gate exists so the SWOT and recommendations see consistent inputs, not because the server needs it.

### Gaps
- No design note in the repository explains the button-per-stage choice; the governance doc's block conditions (Q7) are the closest statement of intent.

## Q3. What the page passes as cached stages on load

### Takeaway
`cachedStages` is always the empty object, the client never sends `mode: "load_cached"`, so no cached result is visible without a click; in production, where generation is gated, a public visitor who clicks sees a 403 instead of the cached brief.

### Cited Findings
- `cachedStages: {}` is hard-coded in the page loader — [src/lib/data/queries.ts:1181-1194](src/lib/data/queries.ts).
- The tab seeds its state from that object — [src/components/analytics/ai-analytics-tab.tsx:270-272](src/components/analytics/ai-analytics-tab.tsx).
- `runStage` is only ever called with `"generate"` or `"regenerate"`; the `load_cached` branch and the `silentMissingCache` option exist but have no caller — [src/components/analytics/ai-analytics-tab.tsx:289-334, 406-443](src/components/analytics/ai-analytics-tab.tsx).
- A `generate` click returns `cacheStatus: "cache_hit"` without a model call when the exact cache key matches, which is the only path to seeing earlier output — [src/lib/ai/run-store.ts:168-173](src/lib/ai/run-store.ts).
- `load_cached` is the only mode exempt from the production generation gate — [src/app/api/ai/_utils.ts:78-88](src/app/api/ai/_utils.ts).
- The type `AiTabData.cachedStages` and the `load_cached` mode are modelled and tested (`load_cached` miss returns failure without generation) — [src/lib/ai/types.ts:120-132](src/lib/ai/types.ts), [tests/ai-stage-cache-runner.test.mjs:103](tests/ai-stage-cache-runner.test.mjs).

### Inferences
- Showing cached briefs instantly needs no schema change: fill `cachedStages` from `loadLatestAiStageCacheByScope` for the seven stages in `getAnalyticsPageData`, or have the tab fire `load_cached` for all stages on mount.
- With `AI_GENERATION_ENABLED` unset in production, the brief is effectively read-only for the public, yet nothing is read; the admin token is the only way to populate it.

### Gaps
- Whether production currently sets `AI_GENERATION_ENABLED` could not be determined from the repository (environment values were not read).

## Q4. Plan documents: sources, fetching, parsing, text reaching the model, citations, coverage

### Takeaway
Plan URLs come from a hand-maintained workbook (`data/SNG Development Plans.xlsx`) and three hard-coded national plan URLs; PDFs are fetched over HTTP, text-extracted with pdf-parse (no OCR, no language handling, no retrieval), split on blank lines into up to 80 passages, and the first 10 passages of each document are what the model sees. Citations are document-level labels, never page or passage references.

### Cited Findings

Where URLs come from
- The ingest reads `data/SNG Development Plans.xlsx` and upserts into `analytics.province_plan_sources` and `analytics.plan_document_sources` — [scripts/ingest-province-plan-sources-supabase.mjs:49, 109-151](scripts/ingest-province-plan-sources-supabase.mjs).
- Nepal sheet columns are `Province | Link | Notes`; Zambia and Serbia sheets are `Admin_2 | Admin_1 | Country | URL`; priority for Nepal comes from the Notes text (5-year = 1, master plan = 2, development plan = 3, else 4), and local rows for the other countries always get priority 1 — [scripts/lib/plan-sources.mjs:29-45, 62-100](scripts/lib/plan-sources.mjs).
- National plans: Nepal's Sixteenth Plan PDF is seeded by migration; Zambia's 8NDP and Serbia's "Srbija i Agenda 2030" PDF are hard-coded — [supabase/migrations/0007_plan_document_sources.sql:76-99](supabase/migrations/0007_plan_document_sources.sql), [scripts/lib/plan-sources.mjs:5-16](scripts/lib/plan-sources.mjs).
- Workbook counts read locally this session (no network): Zambia 116 rows, 112 with a URL, 112 distinct districts, all `.pdf`; Serbia 161 rows, 151 with a URL, 151 distinct municipalities, 123 `.pdf` and 28 other URLs; Nepal 10 rows covering all 7 provinces, all `.pdf` — `data/SNG Development Plans.xlsx` (sheets Zambia, Serbia, Nepal).
- Plan unit: Nepal matches on `municipality.province` (`planSourceAdminLevel: "higher"`), Zambia and Serbia on the municipality name (`"lower"`); matching is exact string equality against `plan_document_sources.province` — [src/lib/countries.ts:71-75, 149-155](src/lib/countries.ts), [src/lib/data/queries.ts:181-191](src/lib/data/queries.ts), [src/lib/ai/documents.ts:190-196](src/lib/ai/documents.ts).
- The country landing page matches plan names with `normalizePlanKey` (trim, lower-case, collapse spaces) instead, so coverage shown there can differ from what the brief finds — [src/lib/country-landing-data.ts:48-50, 119-131](src/lib/country-landing-data.ts).
- Whether the brief tab is offered at all is `country.planningDocuments.aiEnabled`, true for all three countries — [src/lib/countries.ts:71-75, 149-155](src/lib/countries.ts), [src/app/[country]/analytics/page.tsx:114-117, 145-167](src/app/[country]/analytics/page.tsx).
- Units with no candidate get `localPlanUnavailableMessage` and the alignment, SWOT, and recommendation steps are blocked — [src/lib/data/queries.ts:1067-1078](src/lib/data/queries.ts).

Fetching
- `fetchPlanDocument` uses Node `fetch` with user agent `LDT-AI/1.0`, no timeout or size limit; on a TLS certificate error it retries with `rejectUnauthorized: false`, but only for `gov.zm` hosts, following up to 5 redirects — [src/lib/ai/plan-document-fetch.ts:4-11, 46-53, 68-148](src/lib/ai/plan-document-fetch.ts).
- Content is parsed as PDF when the content type or URL says `.pdf`, otherwise HTML tags are stripped with a regex — [src/lib/ai/documents.ts:36-43, 235-246](src/lib/ai/documents.ts).

Parsing, OCR, chunking, language
- PDF text comes from `new PDFParse({ data }).getText()`; pdf.js worker and DOM shims are installed for Vercel; there is no OCR path, so scanned PDFs yield empty text — [src/lib/ai/documents.ts:226-233](src/lib/ai/documents.ts), [src/lib/ai/pdf-worker.ts:86-116](src/lib/ai/pdf-worker.ts).
- Passages: split on two or more newlines, keep those over 80 characters, keep the first 80, ids `passage-N`, titles always null — [src/lib/ai/documents.ts:45-56](src/lib/ai/documents.ts).
- `chunks` is always `[]` and `contentMode` always `"full_text"`; `AiDocumentChunk` with `retrievalScore` is defined but unused — [src/lib/ai/documents.ts:336-363, 437-456](src/lib/ai/documents.ts), [src/lib/ai/types.ts:24-31](src/lib/ai/types.ts).
- Document contexts are cached per (country, source type, province, URL, fingerprint, extraction version `v2`) and the latest row for a URL is reused before any refetch — [src/lib/ai/documents.ts:22, 383-401, 258-297](src/lib/ai/documents.ts), [src/lib/ai/cache.ts:383-460](src/lib/ai/cache.ts).
- No language detection or translation exists in `src/lib/ai`; the system prompt demands English output — [src/lib/ai/prompts.ts:31](src/lib/ai/prompts.ts).
- The stored `extractedText` has no size cap and is returned in every stage response's `structuredOutput` and shown under "Show full extracted text" — [src/lib/ai/pipeline.ts:53-66](src/lib/ai/pipeline.ts), [src/components/analytics/ai-analytics-tab.tsx:201-206, 246-260](src/components/analytics/ai-analytics-tab.tsx).

How much reaches the model
- `excerptDocument` sends passages 1 to 10 of each document, numbered `Passage N:` — [src/lib/ai/prompts.ts:18-23](src/lib/ai/prompts.ts).
- For the national corpus the passages are taken from the concatenated text, so they come from the start of the first document — [src/lib/ai/documents.ts:305-314, 347](src/lib/ai/documents.ts).

Citations
- Prompts ask for document-level labels (`Local/SNG plan`, `National plan`, `Web context`), not passage numbers — [src/lib/ai/prompts.ts:90, 140, 188-195](src/lib/ai/prompts.ts).
- Source references for alignment and SWOT are the two document titles and URLs; the notes list links the whole document — [src/lib/ai/pipeline.ts:925-937, 1056-1073](src/lib/ai/pipeline.ts), [src/components/analytics/ai-result-renderers.tsx:657-705](src/components/analytics/ai-result-renderers.tsx).
- A national corpus's `sourceUrlOrPath` is the synthetic `supabase://` path, which `safeHttpUrl` rejects, so its note renders as "stored copy" with no link — [src/lib/ai/documents.ts:248-256](src/lib/ai/documents.ts), [src/components/analytics/ai-citations.ts:45-53](src/components/analytics/ai-citations.ts), [src/components/analytics/ai-result-renderers.tsx:647-655](src/components/analytics/ai-result-renderers.tsx).

### Inferences
- Because passages are the first ten paragraphs of a plan, the model mostly sees cover matter, forewords, and tables of contents; relevance to the selected score is accidental.
- Nepali and Serbian plans will reach the model untranslated (if the PDF has a text layer) or empty (if scanned), and nothing records which case applies.
- Nepal's seven province plans serve every one of its municipalities, so "local plan alignment" for Nepal is province-level by construction.

### Gaps
- Which URLs actually fetch, parse to non-empty text, or hit the Exa fallback is unknown without running the stage; `extractionMetadata.parser` and `fallbackReason` in `ai_document_contexts` would answer it, but no read script exists.
- Whether pdf-parse 2.x returns per-page text (needed for page citations) was not verified in `node_modules`.
- Nepal unit count: the generated dataset has 751 distinct units and the roadmap says the same, while the brief says 806; Supabase may hold 806 — [src/generated/analytics-data.json], [docs/roadmap/LDT-UI-Overhaul-Plan.md:311](docs/roadmap/LDT-UI-Overhaul-Plan.md).

## Q5. Web context: query, filtering, citation

### Takeaway
One fixed quoted query per unit and score, five Exa `auto` results, full page text fetched, no filtering beyond "has text", summarised by the model and cited by `Hit N` or any label containing web-like words.

### Cited Findings
- Query construction and provider parameters: see Q1 stage 3 — [src/lib/ai/pipeline.ts:120-127](src/lib/ai/pipeline.ts), [src/lib/ai/exa.ts:76-87, 111-121](src/lib/ai/exa.ts).
- Filtering: only hits whose `/contents` text is non-empty survive; order is Exa's; no deduplication by host, no date or language filter — [src/lib/ai/exa.ts:146-166](src/lib/ai/exa.ts).
- The summary prompt forbids fabricating details not in the results — [src/lib/ai/prompts.ts:246-249](src/lib/ai/prompts.ts).
- Citation resolution: `Hit N` maps to the N-th web reference; labels containing web, search, news, online map to all web notes — [src/components/analytics/ai-citations.ts:166-180](src/components/analytics/ai-citations.ts), tested in [tests/ai-citations.test.mjs:51-72](tests/ai-citations.test.mjs).
- The cache input for web context is the query string, so the same query always hits cache; a `regenerate` re-runs Exa — [src/lib/ai/pipeline.ts:711-728](src/lib/ai/pipeline.ts).
- Missing `EXA_API_KEY` throws in search (caught and recorded as skipped) but silently returns null in the contents fallback — [src/lib/ai/exa.ts:13-17, 70-74](src/lib/ai/exa.ts), [src/lib/ai/pipeline.ts:746-767](src/lib/ai/pipeline.ts).

### Inferences
- The quoted query terms (`"Prosperity Score"`, the unit label) are LDT vocabulary, not terms that appear on local news or government pages, so hits are likely either generic or the plan PDF itself.

### Gaps
- No stored run was inspected, so hit quality is unknown.

## Q6. Cost and latency per full brief, and for all units

### Takeaway
A full brief with web context is 5 model calls and 2 Exa calls; at list prices it costs roughly $0.01 to $0.02 in model tokens plus about $0.012 in Exa, so a batch over every unit and score theme (about 3,200 briefs) is on the order of $40 to $70 for the model and another $40 if web context is included. Latency is dominated by sequential stage requests, each of which first re-runs the 6.5-second page data load.

### Cited Findings
- Model calls: narrative (1), alignment (1), web summary (1), SWOT (1), recommendations (1); document stages use no model — [src/lib/ai/pipeline.ts:444-448, 790-794, 910-914, 1041-1045, 1154-1158](src/lib/ai/pipeline.ts).
- Exa calls per brief: `/search` once and `/contents` once with up to 5 URLs; the local plan fallback adds one `/contents` call only when the direct parse fails — [src/lib/ai/exa.ts:76-121](src/lib/ai/exa.ts), [src/lib/ai/pipeline.ts:504](src/lib/ai/pipeline.ts).
- Prices assumed: gpt-4.1-mini $0.40 per 1M input tokens, $0.10 cached input, $1.60 per 1M output tokens, 1,047,576 context, 32,768 max output; the page also marks the model as deprecated — [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini), fetched 2026-10-29.
- Exa: `/search` with `type: auto` $7 per 1,000 requests (up to 10 results), `/contents` text $1 per 1,000 pages — [Exa pricing](https://exa.ai/docs/reference/pricing), fetched 2026-10-29.
- Prompt sizes from the builders: narrative input is 4 header lines plus 5 lines per component for 5 to 8 components (`infrastructure_score` 5, `livability_score` 8, `prosperity_score` 5 components) — [src/lib/ai/prompts.ts:3-16](src/lib/ai/prompts.ts), [src/generated/analytics-data.json] (`scoreDefinitions`), [src/lib/data/labels.ts:41-60](src/lib/data/labels.ts).
- Alignment and SWOT inputs each carry 20 passages whose length is uncapped; web summary input carries up to 5 × 2,500 characters — [src/lib/ai/prompts.ts:18-23, 232](src/lib/ai/prompts.ts).
- No `max_output_tokens`, so output length is bounded only by the prompt's bullet counts — [src/lib/ai/openai.ts:68-80](src/lib/ai/openai.ts).
- Route budget 300 s per stage; no timeout on the OpenAI or Exa `fetch` — [src/app/api/ai/swot-analysis/route.ts:7](src/app/api/ai/swot-analysis/route.ts), [src/lib/ai/openai.ts:62](src/lib/ai/openai.ts).
- Every stage request rebuilds the full analytics page context before generating — [src/lib/ai/pipeline.ts:1198-1205](src/lib/ai/pipeline.ts).
- Brief scope is per municipality and score theme (three themes per unit) — [src/lib/ai/run-store.ts:12-29](src/lib/ai/run-store.ts), [src/components/analytics/ai-analytics-tab.tsx:544-569](src/components/analytics/ai-analytics-tab.tsx).

### Inferences (estimates, 4 characters per token)
- Per-brief tokens, low case (passages about 600 characters): input about 650 (narrative) + 3,500 (alignment) + 4,300 (SWOT) + 3,000 (recommendations) + 3,300 (web summary) ≈ 15k; output about 3.7k. Cost ≈ 15k × $0.40/M + 3.7k × $1.60/M ≈ $0.012.
- High case (page-length passages about 3,000 characters): input ≈ 39k, output 3.7k, cost ≈ $0.021.
- Exa per brief with web context: $0.007 + 5 × $0.001 = $0.012, comparable to the model cost.
- Briefs eligible for the full chain: units with a local plan × 3 themes ≈ (806 or 751 Nepal + 151 Serbia + 112 Zambia) × 3 ≈ 3,000 to 3,200. Model cost for all ≈ $38 to $67 (low to high); with web context add ≈ $38. Narrative only (direction 1) ≈ 3,200 × ~$0.0012 ≈ $4 per release.
- Automatic prompt caching cannot help today because the municipality name appears on line 3 of every user prompt, before the shared passages; reordering (shared passages first) would make most alignment and SWOT input cacheable at $0.10/M within a province.
- Latency floor for a fresh brief: 7 sequential POSTs (national, local, alignment chained; narrative, web, SWOT, recommendations each a click), each paying the page-data load (about 6.5 s in dev, see Q8) plus one model round trip; the first run for a country also pays PDF download and parse of the national plan.

### Gaps
- Real token counts and durations are not stored (`token_usage` is always `{}`), so the ranges above cannot be checked against history without running paid calls.
- Vercel plan limits on `maxDuration` were not checked; 300 s may be capped lower by the account tier.

## Q7. Evaluation and safety today

### Takeaway
Tests cover the cache contract, the citation note resolver, the export, and TLS fallback rules; nothing tests prompts, model output structure, numbers, or neutrality, and the UI shows no disclaimer or review status even though the repository's AI governance policy requires both.

### Cited Findings
- Test runner is `node --test 'tests/*.test.mjs'`, 112 tests across 35 files — [docs/roadmap/LDT-UI-Overhaul-Plan.md:169, 302](docs/roadmap/LDT-UI-Overhaul-Plan.md); counts from `tests/` this session.
- AI-related tests: cache contract stability and regenerate/load_cached semantics — [tests/ai-run-cache-contract.test.mjs:24-111](tests/ai-run-cache-contract.test.mjs); read-through runner behaviour — [tests/ai-stage-cache-runner.test.mjs:40-103](tests/ai-stage-cache-runner.test.mjs); source-text assertions that the pipeline uses the run store and the cards expose provenance — [tests/ai-run-store-integration.test.mjs:5-42](tests/ai-run-store-integration.test.mjs); 10 citation-resolution tests (untracked file) — [tests/ai-citations.test.mjs:38-183](tests/ai-citations.test.mjs); export provenance — [tests/ai-brief-export.test.mjs:6-54](tests/ai-brief-export.test.mjs); TLS fallback host rules — [tests/plan-document-fetch.test.mjs:9-44](tests/plan-document-fetch.test.mjs).
- No test imports `prompts.ts`, `openai.ts`, `exa.ts`, `documents.ts`, or `ai-result-renderers.tsx` (grep over `tests/` this session).
- Output validation: non-empty text only — [src/lib/ai/openai.ts:89-93](src/lib/ai/openai.ts); the parsers fall back to raw paragraphs when headings are missing — [src/components/analytics/ai-result-renderers.tsx:306-311, 618-645](src/components/analytics/ai-result-renderers.tsx).
- No numeric check: the table's Strength/Watchpoint label is computed from the data, but the "interpretation" column is whichever narrative bullet contains the indicator label, with no check that the bullet's numbers match — [src/components/analytics/ai-result-renderers.tsx:167-184, 186-241](src/components/analytics/ai-result-renderers.tsx).
- The evidence gap badge only reports not generated, failed, or missing fingerprint — [src/lib/evidence-gaps.ts:64-92](src/lib/evidence-gaps.ts).
- Neutrality text: the system prompt asks for evidence-based writing and explicit weak-evidence caveats — [src/lib/ai/prompts.ts:34](src/lib/ai/prompts.ts); the export carries one provenance sentence — [src/lib/ai/export.ts:85](src/lib/ai/export.ts); a grep of the analytics components and `src/lib/ai` for "disclaimer", "AI-generated", "review status", or "draft" finds none.
- The governance policy requires a disclaimer ("AI-assisted decision support; not official appraisal or approval"), a human review status, forbidden claims (approval, cost, NPV, "the local plan says" without a cited passage), red-team cases including prompt injection in a document chunk, and a review workflow where recommendations start as Draft — [docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:17-34, 83-96, 163-209](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md).
- Logging is two `console.error` calls (persist failure, route failure); no request, token, or latency logging — [src/lib/ai/pipeline.ts:373](src/lib/ai/pipeline.ts), [src/app/api/ai/_utils.ts:95](src/app/api/ai/_utils.ts).
- Prompt-injection surface: plan passages and web page text are pasted into the user prompt without delimiters or instructions to treat them as data — [src/lib/ai/prompts.ts:70-77, 243-245](src/lib/ai/prompts.ts).
- Access control: production generation is off unless `AI_GENERATION_ENABLED` or the admin token; there is no per-user rate limit in the routes — [src/app/api/ai/_utils.ts:6-27](src/app/api/ai/_utils.ts).
- Relaxed TLS (`rejectUnauthorized: false`) is used for `gov.zm` hosts — [src/lib/ai/plan-document-fetch.ts:46-53, 85-87](src/lib/ai/plan-document-fetch.ts).

### Inferences
- The run store is an untapped evaluation asset: every generation is already persisted with prompt hash and output, so a regression corpus accumulates for free.
- The bullet-count rules in the prompts (4 to 6 per alignment heading, exactly 3 per SWOT quadrant, exactly 3 recommendations) are checkable with the existing parsers, which is the cheapest rubric to add.

### Gaps
- No red-team or output-quality run exists in the repository to quote.

## Q8. Why `tab=ai` takes about 6.5 seconds to render

### Takeaway
The AI tab loads five years of score component values for every unit, paged 1,000 rows at a time with sequential round trips per year, on top of the per-request base data; for Nepal that is roughly 15 sequential pages per year, which the Compare tab never does.

### Cited Findings
- The roadmap records the symptom and that the data path was untouched — [docs/roadmap/LDT-UI-Overhaul-Plan.md:313](docs/roadmap/LDT-UI-Overhaul-Plan.md).
- The page calls `getAnalyticsPageData` with `tab: dataView`; `shouldBuildComponentData` is true for `single` and `ai`, `shouldBuildAiSeries` only for `ai` — [src/app/[country]/analytics/page.tsx:116-117](src/app/[country]/analytics/page.tsx), [src/lib/data/queries.ts:703-706](src/lib/data/queries.ts).
- For `ai`, `buildAiIndicatorSeries` calls `loadScoreComponentHistory` for each component of the selected score (5 or 8), which loads `municipality_score_component_values` for every release year in parallel — [src/lib/data/queries.ts:1047-1060, 643-650, 382-399](src/lib/data/queries.ts).
- Each year's load is `selectAllRows` with `PAGE_SIZE = 1000`, a sequential loop that stops when a page is short — [src/lib/data/queries.ts:33, 326-351, 401-420](src/lib/data/queries.ts).
- Row volume: 18 components per unit (5 + 8 + 5), so per year Nepal ≈ 751 to 806 × 18 ≈ 13.5k to 14.5k rows (14 to 15 pages), Serbia 161 × 18 ≈ 2.9k (3 pages), Zambia 116 × 18 ≈ 2.1k (3 pages); five release years (2021 to 2025) — [src/lib/data/labels.ts:41-60](src/lib/data/labels.ts), [src/generated/analytics-data.json] (years and unit counts, read this session).
- React `cache` deduplicates these loads only within one request, so every page view and every stage POST repeats them — [src/lib/data/queries.ts:6, 353-420](src/lib/data/queries.ts).
- The `ai` tab also runs the plan candidate lookup (one Supabase query, then a module-level cache) — [src/lib/data/queries.ts:193-219, 1069-1072](src/lib/data/queries.ts), [src/lib/ai/documents.ts:97, 117-166](src/lib/ai/documents.ts).
- The base loader (releases, all municipalities, definitions, indicators, boundary count) runs for every tab — [src/lib/data/queries.ts:237-324](src/lib/data/queries.ts).
- The `multi` tab loads only score values and context values for the selected year (one page each) — [src/lib/data/queries.ts:829-838](src/lib/data/queries.ts).
- The brief's chart component imports Plotly, which adds dev-mode compile time on first render — [src/components/analytics/ai-indicator-chart.tsx:3](src/components/analytics/ai-indicator-chart.tsx).

### Inferences
- The 6.5 s figure is most likely Nepal: five parallel chains of about 15 sequential Supabase pages each, plus the base loads, matches a 5 s-plus server time; Serbia and Zambia should be far faster on the same code.
- The same cost is paid again inside every stage POST because `getAiPipelineContextForRequest` reuses this loader, so a seven-stage brief spends on the order of 45 s in data loading alone.
- Fixes that need no schema change: query only the selected score's component ids (`.in("component_id", ids)`), or a server-side aggregate RPC for province and national averages per year, or precompute the series per release into the generated JSON (which already holds five years per unit).

### Gaps
- I did not profile a request; the attribution rests on reading the loader, not on timings.

## Q9. Assessment of the candidate directions

### Takeaway
Directions 1, 2, 6, and 7 fit the existing run store and types with modest code changes and no new tables; 3, 4, and 5 need new schema and a one-off ingest, with 3 as the prerequisite for the others to cite pages or commitments. The largest single gain for the least change is reading the cache on page load and building the pipeline context once per brief.

### Cited Findings and assessment per direction

1. Precompute data-only parts per release and serve instantly
- Fits: the narrative stage has no document dependency ([src/lib/ai/prompts.ts:54](src/lib/ai/prompts.ts)); its cache key is deterministic from release, unit, score, model, prompt, and indicator data ([src/lib/ai/run-store.ts:82-107](src/lib/ai/run-store.ts)); showing it needs `cachedStages` filled ([src/lib/data/queries.ts:1188](src/lib/data/queries.ts)) and the server-side read bypasses the production gate because no `/api/ai` call is made.
- Needs: a batch script (the repository only has ingest scripts, [package.json:5-15](package.json)); it must build the context per unit without `getAnalyticsPageData` or it will spend about 6.5 s × 3,200 (Q8); a review sample needs a status column that does not exist ([supabase/migrations/0012_ai_run_store.sql:7-44](supabase/migrations/0012_ai_run_store.sql)); "peer comparison" has no code today, only province and national averages ([src/lib/data/queries.ts:662-671](src/lib/data/queries.ts)).
- Removes: the step-1 Generate button and the public `generate` path for step 1.
- Risks: a prompt edit invalidates every row (prompt text is hashed into the key); the model page lists gpt-4.1-mini as deprecated, so a model swap forces a full rerun too; cost is small (≈ $4 per release, Q6).

2. Deterministic fact sheet, prose from fact ids, numeric verification
- Fits: the context already holds per-year unit, province, and national values per component and the waterfall contributions that no prompt uses ([src/lib/ai/types.ts:161-185](src/lib/ai/types.ts), [src/lib/data/queries.ts:984-1042](src/lib/data/queries.ts)); ranks exist only for the map tab ([src/lib/data/queries.ts:923-936](src/lib/data/queries.ts)) and would be added to the fact builder.
- Needs: a fact builder with stable ids; a prompt that cites fact ids; structured output (the Responses API `text.format` field is not sent today, [src/lib/ai/openai.ts:68-80](src/lib/ai/openai.ts)); a verifier that parses numbers in the output and compares to facts with a rounding tolerance (values are sent unrounded, [src/lib/ai/prompts.ts:10-12](src/lib/ai/prompts.ts)).
- Removes: the heading and bullet regex parsers and the label-substring matching that pairs bullets with indicators ([src/components/analytics/ai-result-renderers.tsx:90-146, 167-184](src/components/analytics/ai-result-renderers.tsx)).
- Risks: false failures on paraphrased or rounded numbers; the verifier must also handle "above the national average" style claims that have no literal number.

3. Ingest each plan once into structured records, alignment as a matrix
- Fits partly: documents are already fetched once and cached by fingerprint ([src/lib/ai/documents.ts:383-401](src/lib/ai/documents.ts)); the governance policy already demands "The local plan says" only with a cited passage ([docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:96](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)).
- Needs: new tables for commitments (goal, target, sector, budget line, page, language); per-page text (pdf-parse per-page output not verified, Q4 gap); OCR for scanned PDFs and translation or multilingual extraction for Nepali and Serbian, neither present; one extraction call per document (about 10 Nepal, 151 Serbia, 112 Zambia, 3 national ≈ 280 documents; national plans are hundreds of pages, so tens of thousands of tokens each, within the 1M context); a sector or component taxonomy to join the 18 components to commitments ([src/lib/data/labels.ts:41-60](src/lib/data/labels.ts)).
- Removes: per-request PDF fetch and parse, the Exa `/contents` fallback, the first-10-passages prompt sections, and most of the alignment model call (the matrix is a join; prose becomes optional).
- Risks: extraction quality is unreviewed and the governance doc blocks failed OCR and unvalidated translations as sources ([docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:57-66](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)); Nepal's province plans cover all municipalities in a province, so the matrix is identical across a province; schema and ingest work is the largest of all directions.

4. Structured recommendation objects with evidence chains
- Fits: the v1.6 roadmap already specifies an evidence graph (unit → indicator → source → plan passage → opportunity → recommendation), deterministic triggers, and a review flow ([docs/roadmap/LDT-Version-Roadmap.md:52-71](docs/roadmap/LDT-Version-Roadmap.md)); the governance table requires deterministic triggers before any rationale ([docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:69-82](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)).
- Needs: directions 2 and 3 for fact ids and commitment ids; an evidence library of candidate interventions, which does not exist (the Serbia strategy inventory under `src/lib/strategy-inventory/` is a document list, not interventions); structured output and a renderer; confidence and "what would change this" fields; rule checks for forbidden claims (cost, approval).
- Removes: the free-text recommendation template and its regex parser ([src/lib/ai/prompts.ts:181-200](src/lib/ai/prompts.ts), [src/components/analytics/ai-result-renderers.tsx:447-471](src/components/analytics/ai-result-renderers.tsx)); the SWOT stage could become a derived view of weak and strong facts.
- Risks: curating the intervention library is domain work outside the codebase; without it the model will invent interventions as it does now.

5. Similar municipalities and what their plans prioritise
- Fits: scores, 18 component values, and context values (population, land area, road and rail length, flood and heatwave km) exist per unit per year ([src/lib/data/queries.ts:422-443, 845-882](src/lib/data/queries.ts)); nearest neighbours over 116 to 806 units is trivial server-side.
- Needs: a feature scaler and a neighbour query in the loader; direction 3 to say what a neighbour's plan prioritises; for Nepal, neighbour plans collapse to seven province plans.
- Removes: nothing; it adds a section.
- Risks: none technical; interpretive risk that neighbours by score are not peers by geography or population unless context features are weighted.

6. Remove the gates, stream sections, state missing inputs plainly
- Fits: the server already resolves dependencies by reading the cache ([src/lib/ai/pipeline.ts:693-703](src/lib/ai/pipeline.ts)); the missing-local-plan message exists ([src/lib/data/queries.ts:1073-1078](src/lib/data/queries.ts)); the true dependency graph is three rounds deep (Q2).
- Needs: one orchestrator route or server action that builds the context once (instead of per stage, [src/lib/ai/pipeline.ts:1198-1205](src/lib/ai/pipeline.ts)), runs narrative, national, local, and web in parallel, then alignment and SWOT, then recommendations, and streams events; streaming from OpenAI (`stream: true`) is not used today ([src/lib/ai/openai.ts:62-81](src/lib/ai/openai.ts)); the UI's loading and blocked states would be replaced by streamed section states ([src/components/analytics/ai-analytics-tab.tsx:384-511](src/components/analytics/ai-analytics-tab.tsx)).
- Removes: `runPlanningContext`, `buildStageActions`, the `stageRouteMap` (or the seven routes), the blocked notes, and the ordering trap where web context only counts if run first.
- Risks: auto-running on page view multiplies cost by visitors unless outputs are precomputed (direction 1) or auto-run stays admin-only ([src/app/api/ai/_utils.ts:6-27](src/app/api/ai/_utils.ts)); a full chain (five model calls plus a first-time PDF parse) must fit one function's `maxDuration`; a regenerate of one section must invalidate dependants, which the cache key already does for SWOT and recommendations (Q1).

7. Evaluation harness, golden set, review status
- Fits: every run is persisted with prompt hash, input hash, and output ([src/lib/ai/cache.ts:252-301](src/lib/ai/cache.ts)); the parsers can count bullets and headings against the prompt rules; `splitCitations` already reports unresolved labels, so a citation resolution rate is measurable ([src/components/analytics/ai-citations.ts:250-273](src/components/analytics/ai-citations.ts)); `node --test` is in place.
- Needs: a golden set (for example 3 units × 3 themes × 3 countries = 27 briefs, about $0.50 per prompt change at Q6 rates); rubric checks; numeric checks from direction 2; a `review_status` column and UI (the policy names seven statuses, [docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:194-209](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)); writing `token_usage` from the Responses API `usage` field into the existing columns; setting `temperature` so regressions are comparable.
- Removes: nothing; it adds gates to prompt and model changes.
- Risks: nondeterminism at default temperature makes exact-match regressions flaky; checks should be structural and numeric, not textual.

### Further directions seen in the code
- Build the pipeline context once per brief and stop calling `getAnalyticsPageData` per stage; this alone removes most of the per-stage latency (Q8).
- Fill `cachedStages` on load (Q3); one loader change, no schema change, and it makes the production gate coherent.
- Cache `national_plan_context` per country and score rather than per municipality ([src/lib/ai/pipeline.ts:641-650](src/lib/ai/pipeline.ts)).
- Select passages by relevance to the score before any LLM extraction: even a keyword score over the 80 stored passages beats "first 10".
- Set `temperature`, `max_output_tokens`, and a JSON `text.format` in `generateOpenAiText`, and record `usage` into `ai_stage_runs`; all three are missing today ([src/lib/ai/openai.ts:62-99](src/lib/ai/openai.ts)).
- Put the shared, large prompt sections (plan passages) before the unit-specific lines so OpenAI's automatic prefix caching applies at $0.10/M.
- Mark pasted document and web text as data in the prompt, since the governance red-team case for injection is unaddressed ([docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md:177-181](docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)).

### Gaps
- No stored brief was read, so how well the current prompts perform (hallucinated plan claims, numeric errors, unresolved citations) is unmeasured; the run store holds the evidence if a read script is added.
- Vercel function limits, production environment flags, and the live `plan_document_sources` rows were not verified.
