-- Effects for the unarmed leaves. Params: accuracy, hit_count, crit_bonus, power_range + luck_skew,
-- bonus_vs_effect + bonus_mult, part, share, hits, stat + mult/add (+ _range), self, pays_on.

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('jab',            1, 'damage',        7, NULL::int, 1.0, '{"accuracy":1.1}'),
  ('hook',           1, 'damage',       11, NULL, 1.0, '{"accuracy":0.85,"crit_bonus":0.1}'),
  ('body_shot',      1, 'damage',        8, NULL, 1.0, '{"accuracy":0.95}'),
  ('body_shot',      2, 'drain',         0, NULL, 1.0, '{"share":0.08}'),
  ('cross',          1, 'damage',       16, NULL, 1.0, '{"accuracy":0.95}'),
  ('overhand',       1, 'damage',       26, NULL, 1.0, '{"accuracy":0.8}'),
  ('overhand',       2, 'stun',          0, 1,    0.2, '{}'),
  ('palm_strike',    1, 'damage',        9, NULL, 1.0, '{"accuracy":1.0}'),
  ('palm_strike',    2, 'knockback',     0, NULL, 0.3, '{}'),
  ('soft_palm',      1, 'guard',       0.6, 2,    1.0, '{"hits":1}'),
  ('spear_hand',     1, 'damage',       15, NULL, 1.0, '{"accuracy":0.95,"crit_bonus":0.05}'),
  ('chain_punch',    1, 'damage',       18, NULL, 1.0, '{"accuracy":0.95,"hit_count":3}'),
  ('backfist',       1, 'damage',        9, NULL, 1.0, '{"accuracy":1.3}'),
  ('gut_punch',      1, 'damage',        8, NULL, 1.0, '{"accuracy":1.0}'),
  ('gut_punch',      2, 'drain',         0, NULL, 1.0, '{"share":0.05}'),
  ('eye_jab',        1, 'damage',        6, NULL, 1.0, '{"accuracy":1.0}'),
  ('eye_jab',        2, 'debuff',        0, 3,    0.7, '{"stat":"accuracy","mult":0.5}'),
  ('grab',           1, 'bind',          0, 2,    0.8, '{}'),
  ('hip_throw',      1, 'damage',       14, NULL, 1.0, '{"accuracy":0.9}'),
  ('hip_throw',      2, 'stun',          0, 1,    0.6, '{}'),
  ('arm_lock',       1, 'bind',          0, 3,    0.8, '{}'),
  ('arm_lock',       2, 'disable_part',  0, 3,    1.0, '{"part":"hands"}'),
  ('knee_strike',    1, 'damage',       13, NULL, 1.0, '{"accuracy":0.95,"bonus_vs_effect":"bind","bonus_mult":1.5}'),
  ('elbow_strike',   1, 'damage',       11, NULL, 1.0, '{"accuracy":0.95,"crit_bonus":0.1}'),
  ('clinch',         1, 'bind',          0, 3,    0.85, '{}'),
  ('low_kick',       1, 'damage',        8, NULL, 1.0, '{"accuracy":1.0}'),
  ('low_kick',       2, 'debuff',        0, 2,    0.6, '{"stat":"speed","mult":0.8}'),
  ('front_kick',     1, 'damage',       12, NULL, 1.0, '{"accuracy":0.9}'),
  ('front_kick',     2, 'knockback',     0, NULL, 0.6, '{}'),
  ('roundhouse',     1, 'damage',       20, NULL, 1.0, '{"accuracy":0.8}'),
  ('nerve_strike',   1, 'disable_part',  4, 2,    0.7, '{"part":"hands","accuracy":0.95}'),
  ('pressure_jab',   1, 'damage',        7, NULL, 1.0, '{"accuracy":1.0}'),
  ('pressure_jab',   2, 'drain',         0, NULL, 1.0, '{"share":0.1}'),
  ('stumble_strike', 1, 'damage',       13, NULL, 1.0, '{"accuracy":0.9,"power_range":[0.4,1.9],"luck_skew":0.05}'),
  ('sway_step',      1, 'buff',          0, 2,    1.0, '{"stat":"dodgeChance","add_range":[0.0,0.4],"luck_skew":0.05}'),
  ('ginga',          1, 'buff',          0, 2,    1.0, '{"stat":"dodgeChance","add":0.12}'),
  ('esquiva',        1, 'buff',          0, 1,    1.0, '{"stat":"dodgeChance","add":0.35,"pays_on":"dodge"}'),
  ('meia_lua',       1, 'damage',        8, NULL, 1.0, '{"accuracy":0.9}'),
  ('rasteira',       1, 'damage',        9, NULL, 1.0, '{"accuracy":0.9}'),
  ('rasteira',       2, 'stun',          0, 1,    0.5, '{}'),
  ('au',             1, 'damage',        6, NULL, 1.0, '{"accuracy":0.95}'),
  ('au',             2, 'buff',          0, 1,    1.0, '{"stat":"dodgeChance","add":0.15,"self":true}'),
  ('armada',         1, 'damage',       20, NULL, 1.0, '{"accuracy":0.85,"crit_bonus":0.2}'),
  ('martelo',        1, 'damage',       12, NULL, 1.0, '{"accuracy":1.25}'),
  ('bananeira',      1, 'damage',       15, NULL, 1.0, '{"accuracy":0.9}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;

-- Dodge Step: dodge chance is a small fraction, so a multiplier did nothing. A flat add makes it matter.
UPDATE moves.move_effects me
SET params = '{"stat":"dodgeChance","add":0.2}'::jsonb
FROM moves.moves m, moves.effect_types e
WHERE me.move_id = m.id AND m.move_name = 'dodge_step' AND me.effect_type_id = e.id AND e.effect_name = 'buff';
