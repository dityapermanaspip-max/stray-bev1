-- Node finds, out of 1000 per entry. Mostly common (a plain stone is still worth throwing); dark nodes give a
-- little better. Rolled with the gatherer's skill, tool and luck (gather config).
INSERT INTO item.loot_tables (table_name, owner) VALUES
('node_rock_native', 'node'), ('node_rock_corrupted', 'node'),
('node_tree_native', 'node'), ('node_tree_corrupted', 'node'),
('node_herb_native', 'node'), ('node_herb_corrupted', 'node'),
('node_fish_native', 'node'), ('node_fish_corrupted', 'node')
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
SELECT t.id, i.id, x.permille, x.min_qty, x.max_qty
FROM (VALUES
  ('node_rock_native',    'river_stone', 900, 1, 3),
  ('node_rock_native',    'flint',       200, 1, 1),
  ('node_rock_native',    'copper_ore',  120, 1, 1),
  ('node_rock_corrupted', 'river_stone', 900, 1, 3),
  ('node_rock_corrupted', 'copper_ore',  220, 1, 2),
  ('node_rock_corrupted', 'iron_ore',     80, 1, 1),
  ('node_tree_native',    'oak_stick',   700, 1, 2),
  ('node_tree_native',    'oak_log',     450, 1, 1),
  ('node_tree_corrupted', 'oak_stick',   700, 1, 2),
  ('node_tree_corrupted', 'oak_log',     500, 1, 1),
  ('node_tree_corrupted', 'heartwood',   120, 1, 1),
  ('node_herb_native',    'wild_herb',   800, 1, 2),
  ('node_herb_native',    'bitterleaf',  120, 1, 1),
  ('node_herb_corrupted', 'wild_herb',   800, 1, 2),
  ('node_herb_corrupted', 'bitterleaf',  200, 1, 1),
  ('node_herb_corrupted', 'gloomcap',    150, 1, 1),
  ('node_fish_native',    'small_fish',  600, 1, 1),
  ('node_fish_native',    'trout',       100, 1, 1),
  ('node_fish_corrupted', 'small_fish',  600, 1, 2),
  ('node_fish_corrupted', 'trout',       200, 1, 1)
) AS x(table_name, item_name, permille, min_qty, max_qty)
JOIN item.loot_tables t ON t.table_name = x.table_name
JOIN item.items i ON i.item_name = x.item_name
ON CONFLICT (loot_table_id, item_id) DO NOTHING;

-- Nodes per field by biome (a corridor mixes its two biomes). Fishing spots need water next to them (gather config).
UPDATE world.biomes b SET params = b.params || jsonb_build_object('nodes', x.nodes::jsonb)
FROM (VALUES
  ('meadow',      '{"herb":4,"rock":2,"tree":1,"fish":2}'),
  ('grove',       '{"tree":5,"herb":3,"rock":1,"fish":1}'),
  ('desert',      '{"rock":4,"herb":1,"fish":1}'),
  ('snow',        '{"rock":3,"tree":2,"fish":2}'),
  ('volcano',     '{"rock":5}'),
  ('battlefield', '{"rock":2,"herb":3,"tree":1,"fish":1}'),
  ('seashore',    '{"fish":4,"rock":2,"herb":1}')
) AS x(biome, nodes)
WHERE b.biome_name = x.biome AND NOT b.params ? 'nodes';
