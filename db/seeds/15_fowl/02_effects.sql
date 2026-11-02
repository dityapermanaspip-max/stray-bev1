-- Effects for the fowl tree. Damage power is per hit (hit_count hits); chances 0-1. Placeholder numbers.
INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('flutter',            1, 'buff',              0, 2::int, 1.0, '{"stat":"dodgeChance","add":0.12}'),
  ('claw_kick',          1, 'damage',            7, NULL, 1.0,  '{"accuracy":0.95}'),
  ('squawk',             1, 'taunt',             0, 2,    0.8,  '{}'),
  ('triple_peck',        1, 'damage',            4, NULL, 1.0,  '{"accuracy":0.95,"hit_count":3}'),
  ('eye_peck',           1, 'damage',            5, NULL, 1.0,  '{"accuracy":1.0}'),
  ('eye_peck',           2, 'debuff',            0, 2,    0.6,  '{"stat":"accuracy","mult":0.6}'),
  ('grain_snack',        1, 'heal_over_time',    6, 3,    1.0,  '{}'),
  ('wing_buffet',        1, 'damage',           10, NULL, 1.0,  '{"accuracy":0.9}'),
  ('wing_buffet',        2, 'knockback',         0, NULL, 0.35, '{}'),
  ('dust_bath',          1, 'debuff',            0, 2,    0.8,  '{"stat":"accuracy","mult":0.7}'),
  ('flutter_back',       1, 'buff',              0, 3,    1.0,  '{"stat":"dodgeChance","add":0.2}'),
  ('flutter_back',       2, 'counter',           6, 3,    1.0,  '{"trigger":"dodge","tags":[],"take":0,"momentum":0,"accuracy":1.1}'),
  ('talon_rake',         1, 'damage',            8, NULL, 1.0,  '{"accuracy":0.95}'),
  ('talon_rake',         2, 'damage_over_time',  4, 3,    0.35, '{"status":"bleed"}'),
  ('hop_kick',           1, 'damage',            9, NULL, 1.0,  '{"accuracy":0.9}'),
  ('puff_up',            1, 'guard',           0.5, 2,    1.0,  '{"hits":1}'),
  ('alarm_cry',          1, 'buff',              0, 3,    1.0,  '{"stat":"speed","mult":1.15}'),
  ('peck_flurry',        1, 'damage',            4, NULL, 1.0,  '{"accuracy":0.9,"hit_count":5}'),
  ('skull_peck',         1, 'damage',           16, NULL, 1.0,  '{"accuracy":0.85}'),
  ('skull_peck',         2, 'stun',              0, 1,    0.35, '{}'),
  ('gale_wings',         1, 'damage',            6, NULL, 1.0,  '{"accuracy":0.9}'),
  ('gale_wings',         2, 'knockback',         0, NULL, 0.5,  '{}'),
  ('feather_storm',      1, 'damage',            5, NULL, 1.0,  '{"accuracy":0.9}'),
  ('feather_storm',      2, 'debuff',            0, 2,    0.5,  '{"stat":"accuracy","mult":0.8}'),
  ('spur_strike',        1, 'damage',           14, NULL, 1.0,  '{"accuracy":0.9,"crit_bonus":0.2}'),
  ('spur_strike',        2, 'damage_over_time',  5, 3,    0.5,  '{"status":"bleed"}'),
  ('flying_kick',        1, 'damage',           18, NULL, 1.0,  '{"accuracy":0.85}'),
  ('flying_kick',        2, 'knockback',         0, NULL, 0.3,  '{}'),
  ('dawn_crow',          1, 'silence',           0, 2,    0.5,  '{}'),
  ('peck_storm',         1, 'damage',            4, NULL, 1.0,  '{"accuracy":0.9,"hit_count":4}'),
  ('spur_fury',          1, 'damage',            8, NULL, 1.0,  '{"accuracy":0.9,"hit_count":3,"crit_bonus":0.15}'),
  ('spur_fury',          2, 'damage_over_time',  6, 3,    0.5,  '{"status":"bleed"}'),
  ('roosters_challenge', 1, 'taunt',             0, 2,    0.8,  '{}'),
  ('roosters_challenge', 2, 'buff',              0, 3,    1.0,  '{"stat":"critChance","add":0.15,"self":true}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
