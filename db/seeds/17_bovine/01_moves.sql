-- Bovine tree (docs/MOVE_TREES.md): horns, bulk (body), hooves (feet) and temper (voice, tail) for bulls and later
-- other horned beasts. Tier 1 is open from the start; deeper tiers unlock from the parent's level. Placeholder numbers.

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, NULL, 'stamina', m.cost, m.target, m.row_rule,
       m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  -- tier 1 (charge, gore and kick already exist)
  ('bellow',       'control', NULL,     2,  'one_enemy',   'any',   0.1, 0.9, NULL::int),
  ('paw_ground',   'buff',    NULL,     2,  'self',        'any',   0.2, 0.8, NULL),
  -- tier 2
  ('horn_toss',    'attack',  'pierce', 5,  'one_enemy',   'front', 0.3, 1.3, NULL),
  ('hook_horn',    'attack',  'pierce', 4,  'one_enemy',   'front', 0.2, 1.2, NULL),
  ('shoulder_ram', 'attack',  'blunt',  5,  'one_enemy',   'front', 0.4, 1.3, NULL),
  ('thick_hide',   'guard',   NULL,     4,  'self',        'any',   0.0, 0.8, 8),
  ('stomp',        'attack',  'blunt',  4,  'one_enemy',   'front', 0.2, 1.1, NULL),
  ('back_kick',    'attack',  'blunt',  5,  'one_enemy',   'front', 0.4, 1.4, NULL),
  ('tail_swish',   'control', NULL,     2,  'one_enemy',   'front', 0.0, 0.7, NULL),
  ('snort',        'control', NULL,     3,  'enemy_row',   'any',   0.2, 1.0, NULL),
  ('rage',         'buff',    NULL,     4,  'self',        'any',   0.3, 1.0, 8),
  -- tier 3
  ('impale',       'attack',  'pierce', 7,  'one_enemy',   'front', 0.6, 1.6, NULL),
  ('sweep_horns',  'attack',  'pierce', 7,  'enemy_row',   'front', 0.5, 1.6, NULL),
  ('stampede',     'attack',  'blunt',  8,  'enemy_row',   'any',   0.8, 1.8, NULL),
  ('trample',      'attack',  'blunt',  7,  'enemy_row',   'front', 0.5, 1.6, NULL),
  ('ground_pound', 'attack',  'blunt',  8,  'all_enemies', 'front', 0.8, 1.8, NULL),
  ('seeing_red',   'buff',    NULL,     6,  'self',        'any',   0.4, 1.2, 12),
  ('war_bellow',   'control', NULL,     6,  'all_enemies', 'any',   0.4, 1.3, 10),
  -- tier 4
  ('skewer',       'attack',  'pierce', 10, 'one_enemy',   'front', 0.8, 1.9, NULL),
  ('juggernaut',   'attack',  'blunt',  11, 'one_enemy',   'any',   1.0, 2.0, NULL)
) AS m(move_name, category, damage_type_name, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;
