-- Effects for the feline tree. Damage power is per hit (hit_count hits); chances 0-1. Placeholder numbers.
INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('crouch',         1, 'buff',              0, 2::int, 1.0, '{"stat":"dodgeChance","add":0.15}'),
  ('hiss',           1, 'debuff',            0, 2,    0.7,  '{"stat":"speed","mult":0.85}'),
  ('claw_swipe',     1, 'damage',            6, NULL, 1.0,  '{"accuracy":0.9}'),
  ('hook_claw',      1, 'damage',            7, NULL, 1.0,  '{"accuracy":0.95}'),
  ('hook_claw',      2, 'damage_over_time',  5, 3,    0.45, '{"status":"bleed"}'),
  ('quick_nip',      1, 'damage',            5, NULL, 1.0,  '{"accuracy":1.2}'),
  ('scruff_bite',    1, 'damage',            6, NULL, 1.0,  '{"accuracy":0.95}'),
  ('scruff_bite',    2, 'bind',              0, 2,    0.6,  '{}'),
  ('ambush_leap',    1, 'damage',           14, NULL, 1.0,  '{"accuracy":0.85,"crit_bonus":0.25}'),
  ('slip_away',      1, 'buff',              0, 3,    1.0,  '{"stat":"dodgeChance","add":0.25}'),
  ('slip_away',      2, 'counter',           7, 3,    1.0,  '{"trigger":"dodge","tags":[],"take":0,"momentum":0,"accuracy":1.1}'),
  ('cat_nap',        1, 'heal_over_time',    8, 3,    1.0,  '{}'),
  ('yowl',           1, 'debuff',            0, 2,    0.7,  '{"stat":"speed","mult":0.85}'),
  ('tail_twitch',    1, 'debuff',            0, 2,    0.8,  '{"stat":"dodgeChance","mult":0.5}'),
  ('shred',          1, 'damage',            5, NULL, 1.0,  '{"accuracy":0.9,"hit_count":4}'),
  ('shred',          2, 'damage_over_time',  5, 3,    0.4,  '{"status":"bleed"}'),
  ('blinding_swipe', 1, 'damage',           10, NULL, 1.0,  '{"accuracy":0.95}'),
  ('blinding_swipe', 2, 'debuff',            0, 3,    0.7,  '{"stat":"accuracy","mult":0.5}'),
  ('throat_bite',    1, 'damage',           18, NULL, 1.0,  '{"accuracy":0.85,"crit_bonus":0.2}'),
  ('throat_bite',    2, 'damage_over_time',  6, 3,    0.5,  '{"status":"bleed"}'),
  ('pin_down',       1, 'damage',            8, NULL, 1.0,  '{"accuracy":0.9}'),
  ('pin_down',       2, 'bind',              0, 2,    0.7,  '{}'),
  ('land_on_feet',   1, 'guard',           0.4, 3,    1.0,  '{"hits":2}'),
  ('glare',          1, 'stun',              0, 1,    0.4,  '{}'),
  ('caterwaul',      1, 'silence',           0, 2,    0.5,  '{}'),
  ('ribbon_slash',   1, 'damage',            5, NULL, 1.0,  '{"accuracy":0.9,"hit_count":6}'),
  ('ribbon_slash',   2, 'damage_over_time',  6, 3,    0.5,  '{"status":"bleed"}'),
  ('death_grip',     1, 'damage',           20, NULL, 1.0,  '{"accuracy":0.9,"bonus_vs_effect":"bind","bonus_mult":1.6}'),
  ('death_grip',     2, 'bind',              0, 2,    0.6,  '{}'),
  ('shadow_pounce',  1, 'damage',           22, NULL, 1.0,  '{"accuracy":0.9,"crit_bonus":0.3}'),
  ('shadow_pounce',  2, 'stun',              0, 1,    0.3,  '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
