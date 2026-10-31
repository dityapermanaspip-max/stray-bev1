-- Species loot tables, natural and corrupted, rolled when a carcass is butchered.
-- Chances are out of 1000. Some drops are useless or worthless on purpose. Only corrupted tables carry essence.

INSERT INTO item.loot_tables (table_name, owner) VALUES
('chicken_native', 'species'), ('chicken_corrupted', 'species'),
('lizard_native', 'species'),  ('lizard_corrupted', 'species'),
('cat_native', 'species'),     ('cat_corrupted', 'species')
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
SELECT t.id, i.id, x.permille, x.min_qty, x.max_qty
FROM (VALUES
  ('chicken_native',    'chicken_meat',      900,  1, 2),
  ('chicken_native',    'chicken_feather',   800,  2, 6),
  ('chicken_native',    'bone',              400,  1, 2),
  ('chicken_native',    'chicken_beak',      500,  1, 1),
  ('chicken_corrupted', 'tainted_meat',      800,  1, 2),
  ('chicken_corrupted', 'blackened_feather', 800,  2, 6),
  ('chicken_corrupted', 'bone',              400,  1, 2),
  ('chicken_corrupted', 'chicken_beak',      500,  1, 1),
  ('chicken_corrupted', 'essence',           700,  1, 1),
  ('lizard_native',     'lizard_meat',       800,  1, 2),
  ('lizard_native',     'lizard_scale',      700,  2, 5),
  ('lizard_native',     'lizard_tail',       300,  1, 1),
  ('lizard_native',     'lizard_tooth',      400,  1, 3),
  ('lizard_native',     'bone',              400,  1, 3),
  ('lizard_corrupted',  'tainted_meat',      800,  1, 2),
  ('lizard_corrupted',  'dull_scale',        700,  2, 5),
  ('lizard_corrupted',  'lizard_tooth',      400,  1, 3),
  ('lizard_corrupted',  'bone',              400,  1, 3),
  ('lizard_corrupted',  'essence',           700,  1, 1),
  ('cat_native',        'cat_meat',          800,  1, 2),
  ('cat_native',        'cat_pelt',          500,  1, 1),
  ('cat_native',        'cat_claw',          500,  1, 4),
  ('cat_native',        'cat_whisker',       600,  2, 8),
  ('cat_native',        'bone',              400,  1, 3),
  ('cat_corrupted',     'tainted_meat',      800,  1, 2),
  ('cat_corrupted',     'matted_pelt',       500,  1, 1),
  ('cat_corrupted',     'cat_claw',          500,  1, 4),
  ('cat_corrupted',     'cat_whisker',       600,  2, 8),
  ('cat_corrupted',     'essence',           700,  1, 1)
) AS x(table_name, item_name, permille, min_qty, max_qty)
JOIN item.loot_tables t ON t.table_name = x.table_name
JOIN item.items i ON i.item_name = x.item_name
ON CONFLICT (loot_table_id, item_id) DO NOTHING;

UPDATE entity.species s
SET loot_table_native = n.id, loot_table_corrupted = c.id
FROM item.loot_tables n, item.loot_tables c
WHERE n.table_name = s.species_name || '_native' AND c.table_name = s.species_name || '_corrupted'
  AND s.loot_table_native IS NULL;
