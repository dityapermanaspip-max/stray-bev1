-- Starter moves and creature moves. Placeholder numbers, tune in data.
-- Display names and all text come from diegetic_lines, never from move_name.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling)
SELECT m.move_name, m.category, d.id, m.element, m.resource, m.cost, m.target, m.row_rule,
       m.windup, m.recovery, m.channel, m.exp_scaling
FROM (VALUES
  -- Player starter set
  ('punch',        'attack', 'blunt',  NULL, 'stamina', 2,  'one_enemy',   'front', 0.0, 1.0, false, 1.0),
  ('kick',         'attack', 'blunt',  NULL, 'stamina', 3,  'one_enemy',   'front', 0.2, 1.3, false, 1.0),
  ('heavy_strike', 'attack', 'blunt',  NULL, 'stamina', 8,  'one_enemy',   'front', 0.8, 1.8, false, 1.0),
  ('pan_bash',     'attack', 'blunt',  NULL, 'stamina', 4,  'one_enemy',   'front', 0.3, 1.2, false, 1.0),
  ('slash',        'attack', 'slash',  NULL, 'stamina', 3,  'one_enemy',   'front', 0.1, 1.0, false, 1.0),
  ('shot',         'attack', 'pierce', NULL, 'stamina', 3,  'one_enemy',   'any',   0.5, 1.2, false, 1.0),
  ('lucky_shot',   'attack', 'pierce', NULL, 'stamina', 5,  'one_enemy',   'any',   0.5, 1.2, false, 1.0),
  ('dodge_step',   'buff',   NULL,     NULL, 'stamina', 3,  'self',        'any',   0.0, 0.6, false, 1.0),
  ('guard',        'guard',  NULL,     NULL, 'stamina', 2,  'self',        'any',   0.0, 0.8, false, 1.0),
  ('brace',        'guard',  NULL,     NULL, 'stamina', 4,  'self',        'any',   0.2, 1.0, false, 1.0),
  ('bandage',      'heal',   NULL,     NULL, 'stamina', 5,  'one_ally',    'any',   0.5, 1.5, true,  1.0),
  ('scavenge',     'life',   NULL,     NULL, 'stamina', 2,  'self',        'any',   0.0, 1.0, false, 1.0),
  ('taunt',        'control', NULL,    NULL, 'stamina', 3,  'one_enemy',   'any',   0.2, 1.0, false, 1.0),
  ('rally',        'buff',   NULL,     NULL, 'stamina', 6,  'all_allies',  'any',   0.4, 1.4, false, 1.0),
  -- Creature moves (chicken, lizard, cat)
  ('peck',         'attack', 'pierce', NULL, 'stamina', 2,  'one_enemy',   'front', 0.0, 0.9, false, 1.0),
  ('wing_flap',    'control', 'blunt', NULL, 'stamina', 3,  'one_enemy',   'front', 0.2, 1.1, false, 1.0),
  ('bite',         'attack', 'pierce', NULL, 'stamina', 3,  'one_enemy',   'front', 0.1, 1.1, false, 1.0),
  ('tail_whip',    'attack', 'blunt',  NULL, 'stamina', 4,  'one_enemy',   'front', 0.3, 1.3, false, 1.0),
  ('scratch',      'attack', 'slash',  NULL, 'stamina', 2,  'one_enemy',   'front', 0.0, 0.9, false, 1.0),
  ('pounce',       'attack', 'blunt',  NULL, 'stamina', 4,  'one_enemy',   'any',   0.4, 1.2, false, 1.0)
) AS m(move_name, category, damage_type_name, element, resource, cost, target, row_rule,
       windup, recovery, channel, exp_scaling)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;
