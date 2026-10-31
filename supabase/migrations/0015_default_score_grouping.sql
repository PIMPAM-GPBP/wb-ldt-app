-- 0003 seeded the four climate-risk components under infrastructure. Nepal, Serbia and Zambia
-- count them under livability, and npm run ingest:supabase writes that grouping. Vietnam keeps
-- its own grouping in country_score_components (0013).
update analytics.score_components as component
set
  pillar = 'livability',
  parent_score_id = 'livability_score',
  display_order = grouping.display_order
from (
  values
    ('railway_heatwave_score', 5),
    ('road_heatwave_score', 6),
    ('road_flood_score', 7),
    ('railway_flood_score', 8)
) as grouping (component_id, display_order)
where component.id = grouping.component_id;

update analytics.score_definitions as definition
set component_score_keys = coalesce(
  (
    select array_agg(component.id order by component.display_order)
    from analytics.score_components as component
    where component.parent_score_id = definition.id
  ),
  '{}'
);

update analytics.score_definitions
set description = 'Mean of connectivity and accessibility component scores from the score CSV.'
where id = 'infrastructure_score';

update analytics.score_definitions
set description = 'Mean of emissions, air quality, deforestation, emissions-per-area, and transport climate-risk component scores from the score CSV.'
where id = 'livability_score';
