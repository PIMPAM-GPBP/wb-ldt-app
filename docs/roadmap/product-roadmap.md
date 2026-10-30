# LDT product roadmap

The roadmap that the public Roadmap page showed until 30 October 2026, kept here word for word.
The public site no longer has a roadmap page; see `docs/roadmap/LDT-UI-Overhaul-Plan.md`.

The LDT roadmap sequences v1.5 through v1.9 across two-week sprint deadlines, then targets v2 migration of the full backend and frontend to the World Bank's MEGA platform in October 2026.

## Release horizons

The roadmap is intentionally layered: first make the current app trustworthy, then add evidence-backed drafting, scale country and registry workflows, move into scenarios and monitoring, and finally migrate the full product to MEGA.

### v1.5: Trust Foundation

Product hardening. Sprint 1, Jul 6 - Jul 17, 2026, due Jul 17, 2026.

Make the current LDT reliable, consistent, and trustable, with AI brief outputs saved and replayed before heavier public investment workflows.

- Release metadata source of truth
- AI Brief Cache and Run Store
- Country Trust Card and evidence gap badges
- Command center polish, export MVP, responsive states

Release gate: All public pages, exports, and AI stages use the same release metadata, caveats, source fingerprints, and cached run records.

### v1.6: Evidence to Brief

Auditable planning outputs. Sprint 2, Jul 20 - Jul 31, 2026, due Jul 31, 2026.

Convert diagnostics into evidence-backed planning briefs, opportunity families, and concept-note starters.

- AI Planning Brief Report and AI Audit Drawer
- Investment Opportunity Finder and Evidence Graph MVP
- Concept Note Starter and recommendation review flow

Release gate: Every recommendation is traceable to evidence links, caveats, and a human review status.

### v1.7: Scaling Platform

Country factory and registry beta. Sprint 3, Aug 3 - Aug 14, 2026, due Aug 14, 2026.

Make country onboarding repeatable and introduce a lightweight public investment lifecycle view.

- Country Onboarding Factory and validation reports
- Document Intelligence Workbench and Trust Center
- PIM Registry Beta, OC4IDS-ready mapping, observability

Release gate: A new country can be staged from manifests, data packages, source registries, and preview releases.

### v1.8: Decision Studio

Spatial, climate, scenario, counterpart layer. Sprint 4, Aug 17 - Aug 28, 2026, due Aug 28, 2026.

Add transparent spatial prioritization, climate-risk screening, scenario analysis, and workshop-ready outputs.

- Geospatial Prioritization Studio and hazard screen
- Scenario Builder with weights, sensitivity, and caveats
- Counterpart Mode and controlled API/data product

Release gate: Scenario outputs show the weights, evidence, assumptions, map, table, caveats, and sensitivity.

### v1.9: Delivery Loop

Monitoring, transparency, and learning. Sprint 5, Aug 31 - Sep 11, 2026, due Sep 11, 2026.

Link upstream planning to delivery monitoring, procurement transparency, asset records, and ex-post learning.

- GEMS, KoBo, or ODK-style field evidence imports
- Procurement bridge, asset registry, transparency portal
- Cost, delay, anomaly flags and evaluation learning loops

Release gate: Project delivery evidence can inform public transparency and future investment decisions without hiding the rule logic.

### v2: MEGA Platform Migration

World Bank platform migration. Sprint 7, Oct 19 - Oct 31, 2026, due Oct 31, 2026.

Migrate the entire LDT backend and frontend to the World Bank's MEGA platform while preserving evidence lineage, country routes, exports, and auditability.

- MEGA frontend shell migration and route parity
- Backend service, data, auth, and deployment migration
- Cutover rehearsal, rollback plan, and stakeholder acceptance

Release gate: MEGA production cutover is rehearsed, reversible, security-reviewed, and validated against existing country workflows.

## Execution map

A credible LDT expansion needs visible product surfaces, typed data services, evidence governance, and a repeatable country operating model to advance together.

### Frontend experience

The user-facing route from command center to brief, scenario studio, and transparency surfaces.

1. Trust Cards, evidence badges, AI cache provenance, command center actions
2. Planning Brief, Audit Drawer, Opportunity Finder, review status controls
3. Document Workbench, Trust Center, PIM Registry, admin observability
4. Scenario Builder, Counterpart Mode, geospatial prioritization workspace
5. MEGA-compatible frontend shell, navigation, theming, and route parity

### Backend and data model

The services, manifests, validation states, and graph links that let every visible claim be traced.

1. Typed release metadata provider, AI run store, cache keys, caveat model
2. Evidence graph nodes and edges, opportunity triggers, export lineage
3. Country manifests, document states, registry schema, OC4IDS-ready fields
4. Climate/geospatial layers, scenario packages, API/download contracts
5. MEGA backend services, data migration, auth, deployment, and rollback plan

### AI and evidence governance

The policy layer that keeps AI in a synthesis role and makes source quality visible at the point of use.

1. No source, no answer; persist and replay every LLM-backed brief stage
2. Prompt versions, source fingerprints, audit records, human review status
3. Readiness gates for translations, OCR, validation, incident handling
4. AI summarizes tradeoffs only after deterministic outputs are shown
5. MEGA migration preserves audit records, source fingerprints, and review states

### Operating model

The repeatable country delivery motion for analysts, data teams, counterparts, and future transparency users.

1. Country trust review and release QA
2. Analyst-reviewed opportunities and concept-note starter exports
3. Country onboarding factory and document operations queue
4. Workshop packs, data products, field monitoring, public learning loop
5. MEGA cutover readiness, stakeholder signoff, support model, and training

## Governance

The roadmap treats quality, evidence, accessibility, and AI safety as part of the product architecture. These gates protect users from unsupported outputs and keep decision authority where it belongs.

### Human authority stays explicit

LDT can summarize, compare, draft, classify, and explain. It must not approve projects, appraise investments, commit budgets, or make procurement claims.

### Deterministic logic comes first

Opportunity and scenario logic should expose triggers, weights, assumptions, caveats, and supporting evidence before AI writes a rationale.

### Evidence gaps are product states

Missing plans, stale sources, blocked translations, unmatched boundaries, and sparse coverage need visible badges and exportable caveats.

### Every output is inspectable

AI outputs need cache status, run ID, model, prompt version, release ID, source fingerprint, retrieval IDs, generation time, caveats, and review status.

## Release gates

These gates should be applied before the team treats a roadmap slice as ready for stakeholder use, especially when outputs feed planning or investment conversations.

1. Type checks
2. Unit tests for data providers and evidence gating
3. Integration tests for release metadata consistency
4. Accessibility checks for new UI surfaces
5. Security review for AI and server routes
6. Manual QA against at least one country workspace
7. Export QA for Markdown, CSV, and PDF-ready outputs
8. Source and citation QA for AI outputs
