-- Fowl species: chickens gain a voice; the rooster is a chicken variant with spurs, so only it rolls the spur and
-- crowing moves. Move pools are the full fowl tree minus what a body cannot do; the roll opens deeper tiers by unlock.

UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['voice']) AS p)
WHERE species_name = 'chicken' AND NOT ('voice' = ANY(body_parts));

INSERT INTO entity.species (species_name, base_stats, body_parts, ring_min, ring_max, on_expiry)
VALUES ('rooster', '{"str":3,"dex":4,"int":1,"end":2,"luck":3,"charm":2}', ARRAY['beak','feet','spurs','voice','wings'], 1, 4, 'ignore')
ON CONFLICT (species_name) DO NOTHING;

UPDATE entity.species s SET variant_of = c.id, main_stats = ARRAY['str','dex']
FROM entity.species c
WHERE s.species_name = 'rooster' AND c.species_name = 'chicken' AND s.variant_of IS NULL;

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('peck'), ('wing_flap'), ('flutter'), ('claw_kick'), ('squawk'),
  ('triple_peck'), ('eye_peck'), ('grain_snack'), ('wing_buffet'), ('dust_bath'), ('flutter_back'),
  ('talon_rake'), ('hop_kick'), ('puff_up'), ('alarm_cry'),
  ('peck_flurry'), ('skull_peck'), ('gale_wings'), ('feather_storm'), ('flying_kick'), ('peck_storm'),
  ('spur_strike'), ('spur_fury'), ('dawn_crow'), ('roosters_challenge')
) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN entity.species s ON s.species_name IN ('chicken', 'rooster')
WHERE s.species_name = 'rooster'
   OR x.move_name NOT IN ('spur_strike', 'spur_fury', 'dawn_crow', 'roosters_challenge')
ON CONFLICT DO NOTHING;

-- Roosters live wherever chickens do, fewer of them.
INSERT INTO world.biome_species (biome_id, species_id, weight)
SELECT b.id, s.id, x.weight FROM (VALUES
  ('meadow', 2), ('grove', 1), ('battlefield', 1), ('seashore', 1)
) AS x(biome, weight)
JOIN world.biomes b ON b.biome_name = x.biome JOIN entity.species s ON s.species_name = 'rooster'
ON CONFLICT DO NOTHING;

-- Carcass and parts: like a chicken, a little heavier, plus spurs.
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, NULL, x.data::jsonb
FROM (VALUES
  ('rooster_carcass', 'carcass', 'carcass', '{"weight":3.5,"value":7,"piece":true,"carcass_of":"rooster","goods":["chicken"]}'),
  ('rooster_spur',    'part',    'spur',    '{"weight":0.02,"value":2,"goods":["chicken"]}')
) AS x(item_name, type, shape, data)
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO item.loot_tables (table_name, owner) VALUES
('rooster_native', 'species'), ('rooster_corrupted', 'species')
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
SELECT t.id, i.id, x.permille, x.min_qty, x.max_qty
FROM (VALUES
  ('rooster_native',    'chicken_meat',      900, 1, 2),
  ('rooster_native',    'chicken_feather',   800, 3, 7),
  ('rooster_native',    'bone',              400, 1, 2),
  ('rooster_native',    'chicken_beak',      500, 1, 1),
  ('rooster_native',    'rooster_spur',      600, 1, 2),
  ('rooster_corrupted', 'tainted_meat',      800, 1, 2),
  ('rooster_corrupted', 'blackened_feather', 800, 3, 7),
  ('rooster_corrupted', 'bone',              400, 1, 2),
  ('rooster_corrupted', 'rooster_spur',      600, 1, 2),
  ('rooster_corrupted', 'essence',           700, 1, 1)
) AS x(table_name, item_name, permille, min_qty, max_qty)
JOIN item.loot_tables t ON t.table_name = x.table_name
JOIN item.items i ON i.item_name = x.item_name
ON CONFLICT (loot_table_id, item_id) DO NOTHING;

UPDATE entity.species s
SET loot_table_native = n.id, loot_table_corrupted = c.id
FROM item.loot_tables n, item.loot_tables c
WHERE s.species_name = 'rooster' AND n.table_name = 'rooster_native' AND c.table_name = 'rooster_corrupted'
  AND s.loot_table_native IS NULL;
