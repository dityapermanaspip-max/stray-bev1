-- Fowl tree, cinder branch (docs/MOVE_TREES.md): fire moves for the volcano chicken, a chicken born corrupted in
-- volcano hexes. They need the embers body part. Fire burns (status burn, cured by water). Placeholder numbers.

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule,
       m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  -- tier 1
  ('ember_peck',      'attack',  'pierce', 'fire', 2,  'one_enemy',   'front', 0.0, 0.9, NULL::int),
  ('spark_flap',      'attack',  'force',  'fire', 3,  'enemy_row',   'any',   0.3, 1.1, NULL),
  -- tier 2
  ('rekindle',        'heal',    NULL,     NULL,   3,  'self',        'any',   0.4, 1.2, 10),
  ('fire_spit',       'attack',  'force',  'fire', 4,  'one_enemy',   'any',   0.3, 1.2, NULL),
  ('ash_cloud',       'control', NULL,     NULL,   4,  'enemy_row',   'any',   0.4, 1.3, NULL),
  ('molten_feathers', 'guard',   NULL,     NULL,   4,  'self',        'any',   0.0, 0.8, 8),
  -- tier 3
  ('flame_breath',    'attack',  'force',  'fire', 7,  'enemy_row',   'any',   0.6, 1.6, NULL),
  ('cinder_storm',    'attack',  'force',  'fire', 8,  'all_enemies', 'any',   0.7, 1.7, NULL),
  -- tier 4
  ('phoenix_dive',    'attack',  'force',  'fire', 10, 'one_enemy',   'any',   0.9, 1.9, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('ember_peck',      1, 'damage',            6, NULL::int, 1.0, '{"accuracy":1.0}'),
  ('ember_peck',      2, 'damage_over_time',  4, 3,    0.25, '{"status":"burn"}'),
  ('spark_flap',      1, 'damage',            3, NULL, 1.0,  '{"accuracy":0.95}'),
  ('spark_flap',      2, 'damage_over_time',  3, 2,    0.3,  '{"status":"burn"}'),
  ('rekindle',        1, 'heal_over_time',    7, 3,    1.0,  '{}'),
  ('fire_spit',       1, 'damage',           10, NULL, 1.0,  '{"accuracy":0.9}'),
  ('fire_spit',       2, 'damage_over_time',  5, 3,    0.4,  '{"status":"burn"}'),
  ('ash_cloud',       1, 'debuff',            0, 2,    0.8,  '{"stat":"accuracy","mult":0.7}'),
  ('molten_feathers', 1, 'guard',           0.5, 3,    1.0,  '{"hits":2}'),
  ('flame_breath',    1, 'damage',           12, NULL, 1.0,  '{"accuracy":0.9}'),
  ('flame_breath',    2, 'damage_over_time',  6, 3,    0.5,  '{"status":"burn"}'),
  ('cinder_storm',    1, 'damage',            7, NULL, 1.0,  '{"accuracy":0.9}'),
  ('cinder_storm',    2, 'damage_over_time',  4, 3,    0.4,  '{"status":"burn"}'),
  ('phoenix_dive',    1, 'damage',           30, NULL, 1.0,  '{"accuracy":0.85,"crit_bonus":0.15}'),
  ('phoenix_dive',    2, 'damage_over_time',  8, 3,    0.6,  '{"status":"burn"}'),
  ('phoenix_dive',    3, 'knockback',         0, NULL, 0.4,  '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
