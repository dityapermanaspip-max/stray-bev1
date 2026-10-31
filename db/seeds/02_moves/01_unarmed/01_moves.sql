-- Unarmed tree, early leaves (docs/MOVE_TREES.md). New effect types, body parts, and move rows.

INSERT INTO moves.effect_types (effect_name, handler_key) VALUES
('bind', 'bind'),
('drain', 'drain')
ON CONFLICT (effect_name) DO NOTHING;

-- Knee and elbow moves need these parts.
UPDATE entity.races
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['knees','elbows']) AS p)
WHERE race_name = 'human';

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling)
SELECT m.move_name, m.category, d.id, NULL, 'stamina', m.cost, m.target, m.row_rule,
       m.windup, m.recovery, false, 1.0
FROM (VALUES
  -- boxing
  ('jab',            'attack',  'blunt',  1, 'one_enemy', 'front', 0.0, 0.7),
  ('hook',           'attack',  'blunt',  4, 'enemy_row', 'front', 0.3, 1.3),
  ('body_shot',      'attack',  'blunt',  3, 'one_enemy', 'front', 0.1, 1.0),
  ('cross',          'attack',  'blunt',  4, 'one_enemy', 'front', 0.2, 1.2),
  ('overhand',       'attack',  'blunt',  7, 'one_enemy', 'front', 0.9, 1.8),
  -- palm
  ('palm_strike',    'attack',  'blunt',  2, 'one_enemy', 'front', 0.1, 1.0),
  ('soft_palm',      'guard',   NULL,     3, 'self',      'any',   0.0, 0.7),
  ('spear_hand',     'attack',  'pierce', 4, 'one_enemy', 'front', 0.2, 1.1),
  -- karate
  ('chain_punch',    'attack',  'blunt',  4, 'one_enemy', 'front', 0.1, 1.3),
  ('backfist',       'attack',  'blunt',  2, 'one_enemy', 'front', 0.0, 0.8),
  -- brawler
  ('gut_punch',      'attack',  'blunt',  2, 'one_enemy', 'front', 0.1, 1.0),
  ('eye_jab',        'attack',  'pierce', 2, 'one_enemy', 'front', 0.1, 1.0),
  -- grappling
  ('grab',           'control', NULL,     3, 'one_enemy', 'front', 0.2, 1.0),
  ('hip_throw',      'attack',  'blunt',  5, 'one_enemy', 'front', 0.5, 1.5),
  ('arm_lock',       'control', NULL,     6, 'one_enemy', 'front', 0.4, 1.4),
  -- muay thai
  ('knee_strike',    'attack',  'blunt',  3, 'one_enemy', 'front', 0.1, 1.0),
  ('elbow_strike',   'attack',  'slash',  3, 'one_enemy', 'front', 0.1, 1.0),
  ('clinch',         'control', NULL,     4, 'one_enemy', 'front', 0.2, 1.0),
  -- kick
  ('low_kick',       'attack',  'blunt',  2, 'one_enemy', 'front', 0.0, 0.9),
  ('front_kick',     'attack',  'blunt',  3, 'one_enemy', 'front', 0.2, 1.2),
  ('roundhouse',     'attack',  'blunt',  7, 'enemy_row', 'front', 0.6, 1.7),
  -- pressure point
  ('nerve_strike',   'control', 'blunt',  3, 'one_enemy', 'front', 0.2, 1.1),
  ('pressure_jab',   'attack',  'pierce', 3, 'one_enemy', 'front', 0.1, 1.0),
  -- drunken fist
  ('stumble_strike', 'attack',  'blunt',  3, 'one_enemy', 'front', 0.3, 1.2),
  ('sway_step',      'buff',    NULL,     3, 'self',      'any',   0.0, 0.6),
  -- capoeira
  ('ginga',          'buff',    NULL,     2, 'self',      'any',   0.0, 0.5),
  ('esquiva',        'guard',   NULL,     3, 'self',      'any',   0.0, 0.6),
  ('meia_lua',       'attack',  'blunt',  3, 'enemy_row', 'front', 0.2, 1.1),
  ('rasteira',       'attack',  'blunt',  4, 'one_enemy', 'front', 0.3, 1.3),
  ('au',             'attack',  'blunt',  3, 'one_enemy', 'front', 0.2, 1.0),
  ('armada',         'attack',  'blunt',  6, 'one_enemy', 'front', 0.7, 1.6),
  ('martelo',        'attack',  'blunt',  3, 'one_enemy', 'front', 0.0, 0.9),
  ('bananeira',      'attack',  'blunt',  5, 'one_enemy', 'any',   0.4, 1.4)
) AS m(move_name, category, damage_type_name, cost, target, row_rule, windup, recovery)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;
