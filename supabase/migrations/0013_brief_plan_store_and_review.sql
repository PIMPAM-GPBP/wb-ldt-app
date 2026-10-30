-- Planning brief, Phase 3b: the plan store, extracted commitments, and their review.
--
-- These tables stand alone: they key on country codes, unit keys, and plan URLs rather than
-- referencing analytics tables, so they can be built on a fresh branch before production.
-- They live in public because the branch's API exposes only public; analytics would need an
-- API configuration change on every environment.
--
-- Row-level security is on and no policy grants anything: only the server's service role
-- reads or writes them. There is no sign-in: the admin records reviews from the review
-- console, which runs only on a local dev server.

create table if not exists public.brief_plan_documents (
  id text primary key,
  url text not null unique,
  country_code text not null,
  level text not null check (level in ('local', 'national')),
  title text not null,
  -- Units the plan covers; Belgrade's city plan covers 17 municipalities.
  units text[] not null default '{}',
  status text not null check (status in ('text', 'needs OCR', 'not a PDF', 'failed')),
  language text,
  script text,
  pages integer,
  page_quality jsonb not null default '{}'::jsonb,
  error text,
  updated_at timestamptz not null default now()
);

create index if not exists brief_plan_documents_country_idx on public.brief_plan_documents (country_code, level);
create index if not exists brief_plan_documents_units_idx on public.brief_plan_documents using gin (units);

create table if not exists public.brief_plan_pages (
  document_id text not null references public.brief_plan_documents (id) on delete cascade,
  -- The PDF's own page number, which a link's #page= opens.
  page_num integer not null,
  text text not null,
  quality text not null check (quality in ('ok', 'empty', 'garbled')),
  primary key (document_id, page_num)
);

create table if not exists public.brief_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  -- The batch id or live run file the commitments came from; loading it twice is refused.
  source text not null unique,
  model text not null,
  prompt_version text not null,
  openai_batch_id text,
  status text not null check (status in ('submitted', 'completed', 'failed', 'loaded')),
  documents integer not null default 0,
  chunks integer not null default 0,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.brief_commitments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.brief_extraction_runs (id) on delete cascade,
  document_id text not null references public.brief_plan_documents (id) on delete cascade,
  quote text not null,
  -- The page the quote was found on, and the page the model gave.
  page integer not null,
  cited_page integer not null,
  english text,
  components text[] not null check (cardinality(components) > 0),
  kind text not null check (kind in ('project', 'programme', 'target', 'budget', 'policy')),
  strength text not null check (strength in ('specific', 'general')),
  match text not null check (match in ('exact', 'fuzzy')),
  similarity numeric(4, 3) not null,
  created_at timestamptz not null default now()
);

create index if not exists brief_commitments_document_idx on public.brief_commitments (document_id, run_id);

-- One decision per commitment. A plan shared by several units is reviewed once.
create table if not exists public.brief_commitment_reviews (
  commitment_id uuid primary key references public.brief_commitments (id) on delete cascade,
  decision text not null check (decision in ('accepted', 'rejected')),
  -- Corrected components; null keeps the model's.
  components text[],
  note text,
  reviewed_at timestamptz not null default now()
);

-- Sections two and three for one unit and pillar. The public sees them only when status is
-- reviewed and content_hash still matches what the sections would show now.
create table if not exists public.brief_unit_reviews (
  country_code text not null,
  release_key text not null,
  unit_key text not null,
  pillar text not null check (pillar in ('prosperity', 'infrastructure', 'livability')),
  status text not null check (status in ('reviewed', 'withheld')),
  note text,
  fact_sheet_version integer not null,
  prompt_version text not null,
  content_hash text not null,
  reviewed_at timestamptz not null default now(),
  primary key (country_code, release_key, unit_key, pillar)
);

alter table public.brief_plan_documents enable row level security;
alter table public.brief_plan_pages enable row level security;
alter table public.brief_extraction_runs enable row level security;
alter table public.brief_commitments enable row level security;
alter table public.brief_commitment_reviews enable row level security;
alter table public.brief_unit_reviews enable row level security;

revoke all on public.brief_plan_documents, public.brief_plan_pages, public.brief_extraction_runs, public.brief_commitments,
  public.brief_commitment_reviews, public.brief_unit_reviews from anon, authenticated;
grant all on public.brief_plan_documents, public.brief_plan_pages, public.brief_extraction_runs, public.brief_commitments,
  public.brief_commitment_reviews, public.brief_unit_reviews to service_role;
