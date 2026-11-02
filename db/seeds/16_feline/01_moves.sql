-- Feline tree (docs/MOVE_TREES.md): claws, teeth, prowl (body and feet) and voice branches for cats and later big cats.
-- Tier 1 is open from the start; deeper tiers unlock from the parent move's level (04_unlocks.sql). Placeholder numbers.

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, NULL, 'stamina', m.cost, m.target, m.row_rule,
       m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  -- tier 1 (scratch, bite and pounce already exist)
  ('crouch',         'buff',    NULL,     2,  'self',        'any',   0.0, 0.6, NULL::int),
  ('hiss',           'control', NULL,     2,  'one_enemy',   'any',   0.1, 0.9, NULL),
  -- tier 2
  ('claw_swipe',     'attack',  'slash',  4,  'enemy_row',   'front', 0.2, 1.2, NULL),
  ('hook_claw',      'attack',  'slash',  3,  'one_enemy',   'front', 0.1, 1.0, NULL),
  ('quick_nip',      'attack',  'pierce', 1,  'one_enemy',   'front', 0.0, 0.6, NULL),
  ('scruff_bite',    'control', 'pierce', 4,  'one_enemy',   'front', 0.2, 1.1, NULL),
  ('ambush_leap',    'attack',  'blunt',  5,  'one_enemy',   'any',   0.6, 1.4, NULL),
  ('slip_away',      'guard',   'slash',  3,  'self',        'any',   0.0, 0.6, 6),
  ('cat_nap',        'heal',    NULL,     3,  'self',        'any',   0.6, 1.4, 10),
  ('yowl',           'control', NULL,     4,  'enemy_row',   'any',   0.3, 1.2, NULL),
  ('tail_twitch',    'control', NULL,     2,  'one_enemy',   'any',   0.1, 0.8, NULL),
  -- tier 3
  ('shred',          'attack',  'slash',  6,  'one_enemy',   'front', 0.3, 1.4, NULL),
  ('blinding_swipe', 'attack',  'slash',  5,  'one_enemy',   'front', 0.2, 1.2, NULL),
  ('throat_bite',    'attack',  'pierce', 6,  'one_enemy',   'front', 0.4, 1.4, NULL),
  ('pin_down',       'control', 'blunt',  6,  'one_enemy',   'any',   0.5, 1.4, NULL),
  ('land_on_feet',   'guard',   NULL,     4,  'self',        'any',   0.0, 0.8, 8),
  ('glare',          'control', NULL,     5,  'one_enemy',   'any',   0.4, 1.2, 8),
  ('caterwaul',      'control', NULL,     6,  'enemy_row',   'any',   0.5, 1.4, 10),
  -- tier 4
  ('ribbon_slash',   'attack',  'slash',  10, 'one_enemy',   'front', 0.5, 1.8, NULL),
  ('death_grip',     'attack',  'pierce', 9,  'one_enemy',   'front', 0.5, 1.7, NULL),
  ('shadow_pounce',  'attack',  'slash',  9,  'one_enemy',   'any',   0.8, 1.7, NULL)
) AS m(move_name, category, damage_type_name, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;
