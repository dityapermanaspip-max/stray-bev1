-- Pressure from the start. Every wild hex starts with natives at a random 10-80% of max and corrupted at 30-50% of
-- max, on every ring: dense hexes tide within days, about 2 in 61 start in tide. A tide without a vice only feeds;
-- with a vice it invades. The corridor next to a town (the first one out of it, where strays are summoned) sends
-- groups of at most 2; everywhere else the density rule (up to 4).
UPDATE config.balance_config SET value = (value - 'start_fill') || '{"start":{"natives":[0.1,0.8],"corrupted":[0.3,0.5]}}'::jsonb, updated_at = now(),
  description = 'Ring ladder: creature_total[ring] = [mean, spread] of regular creatures'' total core stats; vices vice_bonus above their ring; the boss boss_total; conversion = tick.conversion.rate at the outer ring + conversion_per_ring per ring closer; a wild hex starts with natives and corrupted each at a random share of max in start.natives and start.corrupted.'
WHERE config_key = 'world.rings';

UPDATE config.balance_config SET value = value || '{"near_town_group_max":2}'::jsonb, updated_at = now(),
  description = 'Encounter chance per tile stepped at full density, quiet steps after an encounter, biggest group, biggest group in the corridor next to a town.'
WHERE config_key = 'field.encounter';

-- Re-roll the dev world's wild hexes with the start ranges (repeatable: fixed random seed). The town hex keeps its edge.
SELECT setseed(0.27);
WITH s AS (SELECT value->'start' AS v FROM config.balance_config WHERE config_key = 'world.rings')
UPDATE world.field_population p SET
  natural_count = round(p.max_count * ((s.v->'natives'->>0)::numeric + random()::numeric * ((s.v->'natives'->>1)::numeric - (s.v->'natives'->>0)::numeric))),
  corrupted_count = round(p.max_count * ((s.v->'corrupted'->>0)::numeric + random()::numeric * ((s.v->'corrupted'->>1)::numeric - (s.v->'corrupted'->>0)::numeric)))
FROM s, world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE p.field_ref = h.id::text AND h.field_kind = 'open';

-- Crisis: everyone can hunt. Three times the hunters (0.12 -> 0.36 of the workforce), taken from farmers, laborers and guards.
UPDATE world.town_economy e SET jobs = '{"farmer":0.20,"laborer":0.03,"guard":0.08,
  "hunter":0.36,"woodcutter":0.12,"tanner":0.08,"cook":0.07,"woodworker":0.06}'::jsonb
FROM world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town' AND e.town_ref = h.id::text;
