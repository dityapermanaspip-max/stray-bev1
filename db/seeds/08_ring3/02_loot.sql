-- Ring 3 carcasses and parts. Heavier and worth more than ring 4; a bull or bear carcass is more than one person
-- carries, so it stays as a corpse unless the party shares the load. Only corrupted tables carry essence.
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, NULL, x.data::jsonb
FROM (VALUES
  ('ostrich_carcass', 'carcass', 'carcass', '{"weight":25,"value":30,"piece":true,"carcass_of":"ostrich"}'),
  ('bull_carcass',    'carcass', 'carcass', '{"weight":60,"value":60,"piece":true,"carcass_of":"bull"}'),
  ('bear_carcass',    'carcass', 'carcass', '{"weight":80,"value":80,"piece":true,"carcass_of":"bear"}'),
  ('ostrich_meat', 'food', 'meat', '{"weight":1.2,"value":6,"edible":true,"rots_to":"rotten_meat"}'),
  ('beef',         'food', 'meat', '{"weight":1.5,"value":7,"edible":true,"rots_to":"rotten_meat"}'),
  ('bear_meat',    'food', 'meat', '{"weight":1.5,"value":7,"edible":true,"rots_to":"rotten_meat"}'),
  ('ostrich_plume', 'part', 'feather', '{"weight":0.1,"value":5}'),
  ('bull_hide',     'part', 'hide',    '{"weight":3,"value":10}'),
  ('bull_horn',     'part', 'horn',    '{"weight":0.5,"value":6}'),
  ('bear_pelt',     'part', 'pelt',    '{"weight":4,"value":18}'),
  ('bear_claw',     'part', 'claw',    '{"weight":0.1,"value":5}'),
  ('bear_fat',      'part', 'fat',     '{"weight":0.5,"value":4}')
) AS x(item_name, type, shape, data)
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO item.loot_tables (table_name, owner) VALUES
('ostrich_native', 'species'), ('ostrich_corrupted', 'species'),
('bull_native', 'species'),    ('bull_corrupted', 'species'),
('bear_native', 'species'),    ('bear_corrupted', 'species')
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
SELECT t.id, i.id, x.permille, x.min_qty, x.max_qty
FROM (VALUES
  ('ostrich_native',    'ostrich_meat',      900, 2, 4),
  ('ostrich_native',    'ostrich_plume',     700, 2, 5),
  ('ostrich_native',    'bone',              500, 2, 4),
  ('ostrich_corrupted', 'tainted_meat',      800, 2, 4),
  ('ostrich_corrupted', 'blackened_feather', 700, 3, 8),
  ('ostrich_corrupted', 'bone',              500, 2, 4),
  ('ostrich_corrupted', 'essence',           700, 1, 1),
  ('bull_native',       'beef',              900, 3, 6),
  ('bull_native',       'bull_hide',         700, 1, 1),
  ('bull_native',       'bull_horn',         500, 1, 2),
  ('bull_native',       'bone',              600, 2, 5),
  ('bull_corrupted',    'tainted_meat',      800, 3, 6),
  ('bull_corrupted',    'bull_horn',         500, 1, 2),
  ('bull_corrupted',    'bone',              600, 2, 5),
  ('bull_corrupted',    'essence',           750, 1, 1),
  ('bear_native',       'bear_meat',         900, 3, 6),
  ('bear_native',       'bear_pelt',         700, 1, 1),
  ('bear_native',       'bear_claw',         600, 2, 6),
  ('bear_native',       'bear_fat',          500, 1, 3),
  ('bear_corrupted',    'tainted_meat',      800, 3, 6),
  ('bear_corrupted',    'bear_claw',         600, 2, 6),
  ('bear_corrupted',    'bone',              600, 2, 5),
  ('bear_corrupted',    'essence',           800, 1, 1)
) AS x(table_name, item_name, permille, min_qty, max_qty)
JOIN item.loot_tables t ON t.table_name = x.table_name
JOIN item.items i ON i.item_name = x.item_name
ON CONFLICT (loot_table_id, item_id) DO NOTHING;

UPDATE entity.species s
SET loot_table_native = n.id, loot_table_corrupted = c.id
FROM item.loot_tables n, item.loot_tables c
WHERE n.table_name = s.species_name || '_native' AND c.table_name = s.species_name || '_corrupted'
  AND s.loot_table_native IS NULL;
