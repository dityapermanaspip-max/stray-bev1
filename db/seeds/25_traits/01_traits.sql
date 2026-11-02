-- Trait quota roll (docs/SYSTEMS.md, Traits): a flat quota of 10-300, then picks by weight among traits costing
-- 35%-100% of the quota left. Rarity is weight only. Elements are the basic ones an element trait can roll.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('trait_quota', '{"min":10,"max":300}', 'Trait quota, rolled flat between min and max for a rolled entity (recruit, summoner).'),
('trait_window', '{"min_share":0.35,"max_share":1}', 'A trait pick must cost between min_share and max_share of the quota still left; cheaper traits are not considered.'),
('elements', '["fire","water","ice","earth","wind","lightning","holy","dark"]', 'Basic elements. Element traits and element wards roll from these. Healing magic needs holy affinity.')
ON CONFLICT (config_key) DO NOTHING;

-- cost / weight / modifiers are hidden. Modifier keys are what code reads:
--   resist {kind:id: mult}, stat_add {derived stat: add}, resist_random_element (mult on one rolled element),
--   group (one trait per group), elements (how many random elements to roll) + affinity (their value),
--   dual_wield. Keys marked (hook later) are stored now and read when their system is built.
INSERT INTO entity.traits (trait_name, modifiers, hidden, cost, weight)
SELECT x.name, x.modifiers::jsonb, false, x.cost, x.weight
FROM (VALUES
  -- elements (one per entity)
  ('elemental_affinity', '{"group":"element","elements":1,"affinity":100}', 90, 4),
  ('dual_element',       '{"group":"element","elements":2,"affinity":100}', 200, 2),
  ('triple_element',     '{"group":"element","elements":3,"affinity":100}', 280, 1),
  ('element_ward',       '{"resist_random_element":0.5}', 45, 5),
  -- body and status
  ('iron_gut',      '{"resist":{"status:poison":0.5}}', 25, 8),
  ('thick_blood',   '{"resist":{"status:bleed":0.5}}', 25, 8),
  ('ember_touched', '{"resist":{"status:burn":0.5}}', 25, 6),
  ('hardy',         '{"resist":{"damage_type:blunt":0.85}}', 35, 6),
  -- combat
  ('keen_eyes',   '{"stat_add":{"critChance":0.05}}', 40, 6),
  ('light_feet',  '{"stat_add":{"dodgeChance":0.04}}', 40, 6),
  ('quick_hands', '{"stat_add":{"speed":0.5}}', 50, 5),
  ('steady_aim',  '{"stat_add":{"accuracy":0.4}}', 35, 6),
  ('shield_born', '{"shield_guard_mult":1.25}', 60, 3),
  ('giants_grip', '{"two_handed_in_one":true}', 180, 1),
  -- growth (hook later; stat exp still comes only from move level-ups)
  ('quick_learner', '{"move_exp_mult":1.15}', 50, 4),
  ('late_bloomer',  '{"late_bloom":{"from_level":10,"move_exp_mult":1.25}}', 40, 4),
  ('prodigy',       '{"move_exp_mult":1.3}', 220, 1),
  -- life skills (hook later)
  ('butchers_hands', '{"butchery_quality_steps":1}', 20, 8),
  ('green_thumb',    '{"herb_find_mult":1.2}', 20, 8),
  ('scavenger',      '{"scavenge_mult":1.2}', 20, 8),
  -- standing (hook later)
  ('silver_tongue', '{"haggle_bonus_permille":100}', 40, 5),
  ('honest_face',   '{"favor_gain_mult":1.2}', 35, 5),
  ('loyal',         '{"obedience_bonus":1}', 30, 6),
  -- granted only (Live Dangerously lv10), never rolled (hook later)
  ('berserker',     '{"granted":true}', 0, 0)
) AS x(name, modifiers, cost, weight)
ON CONFLICT (trait_name) DO NOTHING;
