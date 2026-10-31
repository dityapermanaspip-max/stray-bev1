-- Loot (Step 1.8): carcass rot, butchery, carcass prices, coins. Example numbers, tune later.

INSERT INTO config.balance_config (config_key, value, description) VALUES
('carcass_rot', '{"hours":[6,24,72],"chance_mult":[1,0.8,0.5,0.25],"quality_drop":[0,0,1,2]}',
 'Freshness tiers 1-4 (fresh, aging, spoiling, rotten) start at these hours since the kill, times world_time_scale. Per tier: drop chance and price multiplier, part quality steps lost. Rotten food turns into its rots_to item.'),
('quality_ladder', '["crude","common","fine","masterwork"]', 'Quality from worst to best. Parts start at common; butchery skill raises it, rot lowers it.'),
('butchery', '{"move":"butchery","tool_types":["knife"],"npc_level":12,"chance_base":0.6,"chance_per_level":0.03,"quality_up_at":[10,18],"exp_per_carcass":10,"fee_per_weight":2,"cut_share_permille":400,"npc_luck":10}',
 'Butchery skill: drop chance multiplier = chance_base + chance_per_level x level (essence ignores it); one quality step at each quality_up_at level. A town butcher works at npc_level, for fee_per_weight copper per carcass weight, or keeps each part unit with cut_share_permille out of 1000. The town butcher cuts with npc_luck.'),
('carcass_buyers', '{"shop":0.6,"butcher":1,"corrupted_mult":0.8,"shop_buys_corrupted":false}',
 'Whole carcass price = item value x buyer rate x freshness multiplier, x corrupted_mult for corrupted ones.'),
('coin_values', '{"copper_coin":1,"silver_coin":100,"gold_coin":10000}', 'Coin items and their worth in copper.'),
('growth.life.damage_per_level', '0', 'Life skills do not grow in battle.'),
('growth.life.recovery_per_level', '0', 'Life skills do not grow in battle.'),
('growth.life.cost_per_level', '0', 'Life skills do not grow in battle.')
ON CONFLICT (config_key) DO NOTHING;

-- Butchery: a life skill, learned from a butcher (favor gate comes with towns). Each level-up gives dex exp.
INSERT INTO moves.moves (move_name, category, resource, cost, target, row_rule, atb_windup, atb_recovery, channel, exp_scaling)
VALUES ('butchery', 'life', NULL, 0, 'self', 'any', 0, 0, false, 1.0)
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, 'dex', 3 FROM moves.moves m WHERE m.move_name = 'butchery'
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag FROM moves.moves m, (VALUES ('growth.life'), ('life')) AS x(tag)
WHERE m.move_name = 'butchery'
ON CONFLICT (move_id, tag) DO NOTHING;

INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', 'trainer', '{"trainer_tag":"butcher","min_favor_tier":3}'::jsonb
FROM moves.moves m
WHERE m.move_name = 'butchery'
  AND NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a');

-- data: weight, value (copper; 0 = worthless), piece (one per carcass), carcass_of, edible, rots_to.
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, m.id, x.data::jsonb
FROM (VALUES
  ('chicken_carcass', 'carcass', 'carcass', NULL, '{"weight":3,"value":6,"piece":true,"carcass_of":"chicken"}'),
  ('lizard_carcass',  'carcass', 'carcass', NULL, '{"weight":6,"value":10,"piece":true,"carcass_of":"lizard"}'),
  ('cat_carcass',     'carcass', 'carcass', NULL, '{"weight":8,"value":12,"piece":true,"carcass_of":"cat"}'),
  ('chicken_meat', 'food', 'meat', NULL, '{"weight":0.5,"value":3,"edible":true,"rots_to":"rotten_meat"}'),
  ('lizard_meat',  'food', 'meat', NULL, '{"weight":0.8,"value":3,"edible":true,"rots_to":"rotten_meat"}'),
  ('cat_meat',     'food', 'meat', NULL, '{"weight":0.8,"value":2,"edible":true,"rots_to":"rotten_meat"}'),
  ('tainted_meat', 'food', 'meat', NULL, '{"weight":0.8,"value":0,"edible":false}'),
  ('rotten_meat',  'food', 'meat', NULL, '{"weight":0.8,"value":0,"edible":false}'),
  ('chicken_feather',   'part', 'feather', NULL, '{"weight":0.05,"value":1}'),
  ('blackened_feather', 'part', 'feather', NULL, '{"weight":0.05,"value":0}'),
  ('bone',              'part', 'bone',    NULL, '{"weight":0.3,"value":1}'),
  ('chicken_beak',      'part', 'beak',    NULL, '{"weight":0.05,"value":0}'),
  ('lizard_scale',      'part', 'scale',   NULL, '{"weight":0.05,"value":2}'),
  ('dull_scale',        'part', 'scale',   NULL, '{"weight":0.05,"value":0}'),
  ('lizard_tail',       'part', 'tail',    NULL, '{"weight":0.4,"value":2}'),
  ('lizard_tooth',      'part', 'tooth',   NULL, '{"weight":0.02,"value":1}'),
  ('cat_pelt',          'part', 'pelt',    NULL, '{"weight":0.6,"value":5}'),
  ('matted_pelt',       'part', 'pelt',    NULL, '{"weight":0.6,"value":1}'),
  ('cat_claw',          'part', 'claw',    NULL, '{"weight":0.02,"value":1}'),
  ('cat_whisker',       'part', 'whisker', NULL, '{"weight":0.01,"value":0}'),
  ('essence', 'essence', 'essence', NULL, '{"weight":0.1,"value":8}'),
  ('copper_coin', 'coin', 'coin', 'copper', '{"weight":0.01,"value":1}'),
  ('silver_coin', 'coin', 'coin', NULL,     '{"weight":0.01,"value":100}'),
  ('gold_coin',   'coin', 'coin', NULL,     '{"weight":0.01,"value":10000}')
) AS x(item_name, type, shape, material, data)
LEFT JOIN item.materials m ON m.material_name = x.material
ON CONFLICT (item_name) DO NOTHING;

-- Essence quality comes from the corrupted creature's total stats (chicken 13, lizard 13, cat 17).
INSERT INTO item.essence_tiers (tier, min_total_stats, item_id)
SELECT x.tier, x.min_total, i.id
FROM (VALUES ('crude', 0), ('common', 15), ('fine', 30), ('masterwork', 60)) AS x(tier, min_total)
JOIN item.items i ON i.item_name = 'essence'
ON CONFLICT (tier) DO NOTHING;
