-- Resource nodes (Step 2g): mining rocks, trees, herbs and fishing spots, placed by the field seed from the biome's
-- node counts, shared by every player, given back by the world tick. Example numbers, tune later.
-- kinds.<kind>: move (the life skill it uses and grows), tools (tool or weapon types that work; one must be in the
-- bag), bonus_tools (work better: finds x bonus_mult), uses (finds before the node is spent), refill_per_hour
-- (uses given back per world hour), exp (move exp per use), near (a node of this kind only stands next to one of
-- these terrains; empty = anywhere).
-- Find chance per loot entry = permille x (chance_base + chance_per_level x skill level) x tool bonus, then luck.
-- A dark (corrupted) node is guarded: after the find, guard_permille (lowered by luck) for an ambush by corrupted
-- creatures of the field. Which nodes are dark follows the field's hidden corruption share.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('gather', '{"chance_base":0.8,"chance_per_level":0.02,"guard_permille":500,"kinds":{
  "rock":{"move":"mining","tools":["pick","hammer"],"bonus_tools":["pick"],"bonus_mult":1.3,"uses":6,"refill_per_hour":1,"exp":8,"near":[]},
  "tree":{"move":"woodcutting","tools":["knife","sword","axe","saw"],"bonus_tools":["axe","saw"],"bonus_mult":1.3,"uses":4,"refill_per_hour":1,"exp":8,"near":[]},
  "herb":{"move":"herbalism","tools":["knife","sickle"],"bonus_tools":["sickle"],"bonus_mult":1.3,"uses":3,"refill_per_hour":1,"exp":8,"near":[]},
  "fish":{"move":"fishing","tools":["rod"],"bonus_tools":[],"bonus_mult":1,"uses":5,"refill_per_hour":1,"exp":8,"near":["water","sea","frozen_lake"]}}}',
 'Resource nodes: life skill, tools, uses and refill per kind; find chance by skill level; ambush chance at dark nodes.')
ON CONFLICT (config_key) DO NOTHING;

-- Life skills, one per node kind. Learned the first time the player works a node with a fitting tool.
-- Fixed main stats: mining and woodcutting train endurance, fishing luck, herbalism intelligence.
INSERT INTO moves.moves (move_name, category, resource, cost, target, row_rule, atb_windup, atb_recovery, channel, exp_scaling)
SELECT x.name, 'life', NULL, 0, 'self', 'any', 0, 0, false, 1.0
FROM (VALUES ('mining'), ('woodcutting'), ('herbalism'), ('fishing')) AS x(name)
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, 3 FROM moves.moves m
JOIN (VALUES ('mining', 'end'), ('woodcutting', 'end'), ('herbalism', 'int'), ('fishing', 'luck')) AS x(name, stat) ON x.name = m.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag FROM moves.moves m, (VALUES ('growth.life'), ('life')) AS t(tag)
WHERE m.move_name IN ('mining', 'woodcutting', 'herbalism', 'fishing')
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tools (tool_type: what they count as at a node; they are not weapons) and finds.
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, m.id, x.data::jsonb
FROM (VALUES
  ('hatchet',     'tool',     'hatchet', 'iron',  '{"weight":1.5,"tool_type":"axe","value":30}'),
  ('pickaxe',     'tool',     'pickaxe', 'iron',  '{"weight":3,"tool_type":"pick","value":40}'),
  ('fishing_rod', 'tool',     'rod',     'oak',   '{"weight":1,"tool_type":"rod","value":20}'),
  ('flint',       'material', 'flint',   'stone', '{"weight":0.2,"stack":true,"value":2}'),
  ('copper_ore',  'material', 'ore',     NULL,    '{"weight":1,"stack":true,"value":4}'),
  ('iron_ore',    'material', 'ore',     NULL,    '{"weight":1.2,"stack":true,"value":7}'),
  ('heartwood',   'material', 'log',     NULL,    '{"weight":2,"stack":true,"value":9,"goods":["wood"]}'),
  ('wild_herb',   'material', 'herb',    NULL,    '{"weight":0.05,"stack":true,"value":2}'),
  ('bitterleaf',  'material', 'herb',    NULL,    '{"weight":0.05,"stack":true,"value":4}'),
  ('gloomcap',    'food',     'mushroom', NULL,   '{"weight":0.1,"edible":true,"value":5}'),
  ('small_fish',  'food',     'fish',    NULL,    '{"weight":0.3,"edible":true,"value":2}'),
  ('trout',       'food',     'fish',    NULL,    '{"weight":0.6,"edible":true,"value":5}')
) AS x(item_name, type, shape, material, data)
LEFT JOIN item.materials m ON m.material_name = x.material
ON CONFLICT (item_name) DO NOTHING;
