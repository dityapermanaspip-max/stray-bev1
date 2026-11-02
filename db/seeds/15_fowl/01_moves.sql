-- Fowl tree (docs/MOVE_TREES.md): beak, wings, feet and voice branches for chickens, roosters and later birds.
-- Tier 1 is open from the start; deeper tiers unlock from the parent move's level (04_unlocks.sql). Placeholder numbers.

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, NULL, 'stamina', m.cost, m.target, m.row_rule,
       m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  -- tier 1 (peck and wing_flap already exist)
  ('flutter',            'buff',    NULL,     2,  'self',        'any',   0.0, 0.6, NULL::int),
  ('claw_kick',          'attack',  'slash',  2,  'one_enemy',   'front', 0.1, 1.0, NULL),
  ('squawk',             'control', NULL,     2,  'one_enemy',   'any',   0.1, 0.9, NULL),
  -- tier 2
  ('triple_peck',        'attack',  'pierce', 4,  'one_enemy',   'front', 0.1, 1.1, NULL),
  ('eye_peck',           'attack',  'pierce', 3,  'one_enemy',   'front', 0.1, 1.0, NULL),
  ('grain_snack',        'heal',    NULL,     3,  'self',        'any',   0.3, 1.2, 8),
  ('wing_buffet',        'attack',  'blunt',  4,  'one_enemy',   'front', 0.2, 1.2, NULL),
  ('dust_bath',          'control', NULL,     4,  'enemy_row',   'any',   0.4, 1.3, NULL),
  ('flutter_back',       'guard',   'pierce', 3,  'self',        'any',   0.0, 0.6, 6),
  ('talon_rake',         'attack',  'slash',  3,  'one_enemy',   'front', 0.1, 1.0, NULL),
  ('hop_kick',           'attack',  'blunt',  4,  'one_enemy',   'any',   0.4, 1.2, NULL),
  ('puff_up',            'guard',   NULL,     3,  'self',        'any',   0.0, 0.8, NULL),
  ('alarm_cry',          'buff',    NULL,     4,  'all_allies',  'any',   0.3, 1.2, 8),
  -- tier 3
  ('peck_flurry',        'attack',  'pierce', 6,  'one_enemy',   'front', 0.3, 1.4, NULL),
  ('skull_peck',         'attack',  'pierce', 6,  'one_enemy',   'front', 0.5, 1.5, NULL),
  ('gale_wings',         'attack',  'blunt',  7,  'enemy_row',   'any',   0.6, 1.6, NULL),
  ('feather_storm',      'attack',  'slash',  8,  'all_enemies', 'any',   0.7, 1.7, NULL),
  ('spur_strike',        'attack',  'pierce', 5,  'one_enemy',   'front', 0.2, 1.2, NULL),
  ('flying_kick',        'attack',  'blunt',  7,  'one_enemy',   'any',   0.7, 1.6, NULL),
  ('dawn_crow',          'control', NULL,     6,  'enemy_row',   'any',   0.5, 1.4, 10),
  -- tier 4
  ('peck_storm',         'attack',  'pierce', 10, 'enemy_row',   'front', 0.8, 1.8, NULL),
  ('spur_fury',          'attack',  'pierce', 9,  'one_enemy',   'front', 0.4, 1.6, NULL),
  ('roosters_challenge', 'control', NULL,     8,  'all_enemies', 'any',   0.4, 1.3, 12)
) AS m(move_name, category, damage_type_name, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

-- Tier 4 moves pay more stat exp per level-up (growth.tiers had tiers 1-3).
UPDATE config.balance_config
SET value = jsonb_set(value, '{tiers,4}', '[9,4]'::jsonb)
WHERE config_key = 'growth.tiers' AND NOT (value->'tiers' ? '4');
