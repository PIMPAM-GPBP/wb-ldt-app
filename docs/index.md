# Local Development Tracker — Documentation

This documentation describes the Local Development Tracker (LDT) implementation: the site, data model, API routes, and architecture used for release metadata, evidence capture, and AI-assisted briefs.

Quick links:

- [Architecture & Data Model](roadmap/LDT-Architecture-and-Data-Model.md)
- [Feature Backlog & Acceptance Criteria](roadmap/LDT-Feature-Backlog-and-Acceptance-Criteria.md)
- [Sprints](sprints/)

## Introduction

LDT is a Next.js frontend backed by Supabase/Postgres/PostGIS as the system of record. Data ingestion jobs parse and validate country plans, create document chunks and source fingerprints, and precompute AI retrievals. The frontend uses a typed data provider layer and public API routes to surface release metadata, trust indicators, document readiness, and generated investment opportunities. AI outputs are cached and auditable via an `ai_runs` store to ensure reproducibility.

## Architecture Diagram

The diagram below summarizes the core components: database (Supabase), backend jobs and API, Next.js frontend with a typed provider layer, AI retrieval and model stack, and external integrations.

```mermaid
flowchart LR
    subgraph DB[Supabase / Postgres / PostGIS (System of Record)]
        CR[country_releases]
        CM[country_manifests]
        SR[source_registry]
        DC[document_chunks]
        EI[evidence_items / evidence_edges]
        AR[ai_runs]
    end

    subgraph Backend[Server / Jobs / API]
        Jobs[Jobs: ingestCountry, validateRelease, parseDocuments, precomputeAI, exportReport]
        API[/API routes/]
        Providers[Typed Data Providers]
    end

    subgraph Frontend[Next.js App]
        UI[Pages & Components]
        DP[Data Provider Layer]
    end

    subgraph AI[LLM & Retrieval]
        Retriever[Retrieval & Embeddings]
        Cache[AI Run Cache (ai_runs)]
        LLM[LLM Models]
    end

    subgraph Integrations[External Integrations]
        PIM[PIM / Procurement]
        Hazards[Hazard Screening]
        Exports[Export / Reporting Services]
    end

    Jobs --> DB
    API --> DB
    Providers --> DB
    UI --> API
    UI --> DP --> API
    API --> LLM
    API --> Retriever
    Retriever --> DB
    LLM --> Cache
    Cache --> DB
    Jobs --> Retriever
    Jobs --> Cache
    API --> Exports
    API --> PIM
    API --> Hazards
    SR --> Retriever
    DC --> Retriever
    EI --> API
    AR --> API

```

## How to preview

Install MkDocs and run the local server:

```bash
pip install mkdocs
mkdocs serve
```

See the roadmap folder for detailed design notes and table schemas.
