-- Ostrich: the fowl tree plus a strider branch (kicks). Strider grows from Sprint, never from Kick.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('sprint', 'buff', NULL, NULL, 2, 'self', 'any', 0.0, 0.6, NULL::int),
  ('long_stride', 'buff', NULL, NULL, 3, 'self', 'any', 0.0, 0.6, NULL),
  ('talon_kick', 'attack', 'slash', NULL, 4, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('gutting_kick', 'attack', 'slash', NULL, 7, 'one_enemy', 'front', 0.5, 1.5, NULL),
  ('dust_trail', 'control', NULL, NULL, 5, 'enemy_row', 'any', 0.3, 1.2, NULL),
  ('thunder_kick', 'attack', 'blunt', NULL, 10, 'one_enemy', 'front', 0.8, 1.9, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('sprint', 1, 'buff', 0, 2::int, 1.0, '{"stat":"speed","mult":1.2}'),
  ('long_stride', 1, 'buff', 0, 2, 1.0, '{"stat":"dodgeChance","add":0.2}'),
  ('talon_kick', 1, 'damage', 14, NULL, 1.0, '{"accuracy":0.9,"crit_bonus":0.1}'),
  ('gutting_kick', 1, 'damage', 22, NULL, 1.0, '{"accuracy":0.85}'),
  ('gutting_kick', 2, 'damage_over_time', 6, 3, 0.5, '{"status":"bleed"}'),
  ('dust_trail', 1, 'debuff', 0, 2, 0.8, '{"stat":"accuracy","mult":0.7}'),
  ('thunder_kick', 1, 'damage', 30, NULL, 1.0, '{"accuracy":0.85}'),
  ('thunder_kick', 2, 'knockback', 0, NULL, 0.5, '{}'),
  ('thunder_kick', 3, 'stun', 0, 1, 0.25, '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
