-- Effects for the bovine tree. Damage power is per hit (hit_count hits); chances 0-1. Placeholder numbers.
INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('bellow',       1, 'taunt',             0, 2::int, 0.8, '{}'),
  ('paw_ground',   1, 'buff',              0, 3,    1.0,  '{"stat":"critChance","add":0.1}'),
  ('horn_toss',    1, 'damage',           10, NULL, 1.0,  '{"accuracy":0.9}'),
  ('horn_toss',    2, 'knockback',         0, NULL, 0.5,  '{}'),
  ('hook_horn',    1, 'damage',            9, NULL, 1.0,  '{"accuracy":0.9}'),
  ('hook_horn',    2, 'damage_over_time',  5, 3,    0.45, '{"status":"bleed"}'),
  ('shoulder_ram', 1, 'damage',           12, NULL, 1.0,  '{"accuracy":0.85}'),
  ('shoulder_ram', 2, 'stun',              0, 1,    0.25, '{}'),
  ('thick_hide',   1, 'guard',           0.5, 3,    1.0,  '{"hits":2}'),
  ('stomp',        1, 'damage',           12, NULL, 1.0,  '{"accuracy":0.9}'),
  ('stomp',        2, 'debuff',            0, 2,    0.3,  '{"stat":"speed","mult":0.8}'),
  ('back_kick',    1, 'damage',           15, NULL, 1.0,  '{"accuracy":0.8}'),
  ('back_kick',    2, 'knockback',         0, NULL, 0.4,  '{}'),
  ('tail_swish',   1, 'debuff',            0, 2,    0.8,  '{"stat":"accuracy","mult":0.8}'),
  ('snort',        1, 'debuff',            0, 2,    0.7,  '{"stat":"speed","mult":0.85}'),
  ('rage',         1, 'buff',              0, 3,    1.0,  '{"stat":"speed","mult":1.2}'),
  ('impale',       1, 'damage',           22, NULL, 1.0,  '{"accuracy":0.85,"crit_bonus":0.15}'),
  ('impale',       2, 'damage_over_time',  6, 3,    0.5,  '{"status":"bleed"}'),
  ('sweep_horns',  1, 'damage',           10, NULL, 1.0,  '{"accuracy":0.85}'),
  ('sweep_horns',  2, 'knockback',         0, NULL, 0.4,  '{}'),
  ('stampede',     1, 'damage',           14, NULL, 1.0,  '{"accuracy":0.85}'),
  ('stampede',     2, 'knockback',         0, NULL, 0.4,  '{}'),
  ('trample',      1, 'damage',            8, NULL, 1.0,  '{"accuracy":0.9,"hit_count":2}'),
  ('ground_pound', 1, 'damage',            7, NULL, 1.0,  '{"accuracy":0.9}'),
  ('ground_pound', 2, 'stun',              0, 1,    0.3,  '{}'),
  ('seeing_red',   1, 'buff',              0, 3,    1.0,  '{"stat":"critChance","add":0.2}'),
  ('seeing_red',   2, 'buff',              0, 3,    1.0,  '{"stat":"speed","mult":1.15}'),
  ('war_bellow',   1, 'taunt',             0, 2,    0.8,  '{}'),
  ('war_bellow',   2, 'debuff',            0, 2,    0.6,  '{"stat":"accuracy","mult":0.8}'),
  ('skewer',       1, 'damage',           30, NULL, 1.0,  '{"accuracy":0.85,"crit_bonus":0.15}'),
  ('skewer',       2, 'damage_over_time',  7, 3,    0.6,  '{"status":"bleed"}'),
  ('skewer',       3, 'stun',              0, 1,    0.25, '{}'),
  ('juggernaut',   1, 'damage',           26, NULL, 1.0,  '{"accuracy":0.85}'),
  ('juggernaut',   2, 'knockback',         0, NULL, 0.6,  '{}'),
  ('juggernaut',   3, 'stun',              0, 1,    0.3,  '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
