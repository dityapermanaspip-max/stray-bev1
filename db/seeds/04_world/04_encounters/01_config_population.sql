-- Encounters (Step 2d). Per tile stepped: per_step_permille x density (total pop / max pop, capped at 1),
-- lowered by the leader's luck. grace_steps: steps with no roll after entering a field or an encounter.
-- group_max: biggest group at full density (1 + density x (group_max - 1), so quiet fields send one creature).
INSERT INTO config.balance_config (config_key, value, description) VALUES
('field.encounter', '{"per_step_permille":100,"grace_steps":6,"group_max":4}', 'Encounter chance per tile stepped at full density, quiet steps after an encounter, biggest group.')
ON CONFLICT (config_key) DO NOTHING;

-- Dev world populations: max pop 10000 per hex. Meadow: 1000 chickens, 2000 lizards. Grove: 2000 cats, 1000 of them corrupted extra.
-- safe: natives never converted or eaten below this. Corridors mix the two hexes by their place in the chain.
DELETE FROM world.field_population p
USING world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE p.field_ref = h.id::text;

INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
SELECT h.id::text, s.id, x.native_n, x.corrupted_n, x.safe_n, x.max_n
FROM world.hexes h
JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
JOIN (VALUES
  (0, 'chicken', 1000, 0, 200, 5000), (0, 'lizard', 2000, 0, 400, 5000),
  (1, 'cat', 2000, 1000, 400, 10000)
) AS x(q, species, native_n, corrupted_n, safe_n, max_n) ON x.q = h.q AND h.r = 0
JOIN entity.species s ON s.species_name = x.species
ON CONFLICT (field_ref, species_id) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('field.encounter', 'alarmed', 'Something bursts out of the grass at me.'),
  ('field.encounter', 'alarmed', 'I am not alone here.'),
  ('field.encounter', 'alarmed', 'A rustle, then movement, right in front of me.'),
  ('field.encounter', 'alarmed', 'Eyes in the brush, and they have seen me.'),
  ('field.encounter', 'alarmed', 'I freeze. Something blocks my way.'),
  ('field.encounter', 'alarmed', 'Here they come.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
