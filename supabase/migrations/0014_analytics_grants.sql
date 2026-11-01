-- The app and the ingest scripts reach analytics only with the service role. Production got its
-- grants, and RLS on these two tables, outside these migrations, so a database built from this
-- folder could not serve the app.
alter table analytics.countries enable row level security;
alter table analytics.province_plan_sources enable row level security;

grant usage on schema analytics to service_role;
grant all privileges on all tables in schema analytics to service_role;
grant all privileges on all sequences in schema analytics to service_role;
grant execute on all functions in schema analytics to service_role;

alter default privileges in schema analytics grant all on tables to service_role;
alter default privileges in schema analytics grant all on sequences to service_role;
alter default privileges in schema analytics grant execute on functions to service_role;

-- RLS with no policies already hides every row from anon and authenticated, but
-- upsert_municipality_boundary is security definer and bypasses RLS. 0008, 0009, 0011 and 0013
-- already revoke these roles on their tables; this does the same for the rest and the functions.
revoke all privileges on all tables in schema analytics from anon, authenticated;
revoke all privileges on all sequences in schema analytics from anon, authenticated;
revoke execute on all functions in schema analytics from public, anon, authenticated;

-- Postgres grants EXECUTE on new functions to PUBLIC globally, which a schema-level default
-- cannot undo. A new security definer function here must revoke it in its own migration.
alter default privileges in schema analytics revoke all on tables from anon, authenticated;
alter default privileges in schema analytics revoke all on sequences from anon, authenticated;
alter default privileges in schema analytics revoke execute on functions from anon, authenticated;
