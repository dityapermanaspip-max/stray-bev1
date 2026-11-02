-- The volcano chicken: a chicken variant born corrupted (every one is corrupted; it never breeds), living in volcano
-- hexes. Its pool is the hen's fowl moves plus the cinder branch. Shrugs off fire and burns, fears water.

INSERT INTO entity.species (species_name, base_stats, body_parts, ring_min, ring_max, on_expiry)
VALUES ('volcano_chicken', '{"str":2,"dex":4,"int":3,"end":2,"luck":2,"charm":1}', ARRAY['beak','embers','feet','voice','wings'], 1, 4, 'devour')
ON CONFLICT (species_name) DO NOTHING;

UPDATE entity.species s SET variant_of = c.id, main_stats = ARRAY['int','dex'], born_corrupted = true
FROM entity.species c
WHERE s.species_name = 'volcano_chicken' AND c.species_name = 'chicken' AND s.variant_of IS NULL;

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('peck'), ('wing_flap'), ('flutter'), ('claw_kick'), ('squawk'),
  ('triple_peck'), ('eye_peck'), ('grain_snack'), ('wing_buffet'), ('dust_bath'), ('flutter_back'),
  ('talon_rake'), ('hop_kick'), ('puff_up'), ('alarm_cry'),
  ('peck_flurry'), ('skull_peck'), ('gale_wings'), ('feather_storm'), ('flying_kick'), ('peck_storm'),
  ('ember_peck'), ('spark_flap'), ('rekindle'), ('fire_spit'), ('ash_cloud'), ('molten_feathers'),
  ('flame_breath'), ('cinder_storm'), ('phoenix_dive')
) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN entity.species s ON s.species_name = 'volcano_chicken'
ON CONFLICT DO NOTHING;

INSERT INTO entity.resistances (owner_kind, owner_id, target_kind, target_id, mult)
SELECT 'species', s.id, x.kind, x.target, x.mult
FROM (VALUES ('element', 'fire', 0.5), ('status', 'burn', 0.0), ('element', 'water', 1.5)) AS x(kind, target, mult)
JOIN entity.species s ON s.species_name = 'volcano_chicken'
ON CONFLICT (owner_kind, owner_id, target_kind, target_id) DO NOTHING;

INSERT INTO world.biome_species (biome_id, species_id, weight)
SELECT b.id, s.id, 3 FROM world.biomes b JOIN entity.species s ON s.species_name = 'volcano_chicken'
WHERE b.biome_name = 'volcano'
ON CONFLICT DO NOTHING;

-- Carcass and parts. Born corrupted, so it only ever drops from its corrupted table (the native slot points there too).
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, NULL, x.data::jsonb
FROM (VALUES
  ('volcano_chicken_carcass', 'carcass', 'carcass', '{"weight":3,"value":3,"piece":true,"carcass_of":"volcano_chicken"}'),
  ('ember_feather',           'part',    'feather', '{"weight":0.05,"value":6}')
) AS x(item_name, type, shape, data)
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO item.loot_tables (table_name, owner) VALUES ('volcano_chicken_corrupted', 'species')
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
SELECT t.id, i.id, x.permille, x.min_qty, x.max_qty
FROM (VALUES
  ('tainted_meat',      800, 1, 2),
  ('blackened_feather', 700, 2, 5),
  ('ember_feather',     500, 1, 3),
  ('bone',              400, 1, 2),
  ('essence',           800, 1, 1)
) AS x(item_name, permille, min_qty, max_qty)
JOIN item.loot_tables t ON t.table_name = 'volcano_chicken_corrupted'
JOIN item.items i ON i.item_name = x.item_name
ON CONFLICT (loot_table_id, item_id) DO NOTHING;

UPDATE entity.species s SET loot_table_native = t.id, loot_table_corrupted = t.id
FROM item.loot_tables t
WHERE s.species_name = 'volcano_chicken' AND t.table_name = 'volcano_chicken_corrupted' AND s.loot_table_corrupted IS NULL;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('move_name_ember_peck', 'Ember Peck'), ('move_name_spark_flap', 'Spark Flap'), ('move_name_rekindle', 'Rekindle'),
  ('move_name_fire_spit', 'Fire Spit'), ('move_name_ash_cloud', 'Ash Cloud'), ('move_name_molten_feathers', 'Molten Feathers'),
  ('move_name_flame_breath', 'Flame Breath'), ('move_name_cinder_storm', 'Cinder Storm'), ('move_name_phoenix_dive', 'Phoenix Dive'),
  ('species_name_volcano_chicken', 'Volcano Chicken'),
  ('item_name_volcano_chicken_carcass', 'Volcano chicken carcass'), ('item_name_ember_feather', 'Ember feather')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
