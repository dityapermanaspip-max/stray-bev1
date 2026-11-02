-- Weapon throws: Javelin Throw (Basic Throw lv10 + Spear Thrust lv10) and Axe Throw (Basic Throw lv5 + Axe Chop lv6).
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('javelin_throw', 'attack', 'pierce', NULL, 5, 'one_enemy', 'any', 0.4, 1.4, NULL::int),
  ('axe_throw', 'attack', 'slash', NULL, 4, 'one_enemy', 'any', 0.3, 1.2, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('javelin_throw', 1, 'damage', 16, NULL::int, 1.0, '{"accuracy":0.95,"crit_bonus":0.1}'),
  ('axe_throw', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.9}'),
  ('axe_throw', 2, 'damage_over_time', 2, 3, 0.2, '{"status":"bleed"}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
