insert into analytics.countries (
  country_code,
  country_name,
  country_slug,
  is_active,
  display_order
)
values
  ('VNM', 'Vietnam', 'vietnam', true, 4)
on conflict (country_code) do update
set
  country_name = excluded.country_name,
  country_slug = excluded.country_slug,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

create table if not exists analytics.country_score_components (
  country_code text not null
    references analytics.countries(country_code) on delete cascade,
  component_id text not null
    references analytics.score_components(id) on delete cascade,
  parent_score_id text not null
    references analytics.score_definitions(id) on delete cascade,
  display_order integer not null,
  primary key (country_code, component_id)
);

alter table analytics.country_score_components enable row level security;

revoke all on table analytics.country_score_components from anon, authenticated;
grant all on table analytics.country_score_components to service_role;

comment on table analytics.country_score_components is
'Per-country grouping of component scores under pillar scores. A country with rows here uses them instead of analytics.score_components.parent_score_id.';
