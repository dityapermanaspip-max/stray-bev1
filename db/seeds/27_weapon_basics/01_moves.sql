-- Tier 1 starters of the weapon trees (docs/MOVE_TREES.md): great sword, katana, mace, tonfa, shield, spear, axe, pick, rod.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('greatsword_sweep', 'attack', 'slash', NULL, 5, 'enemy_row', 'front', 0.5, 1.5, NULL::int),
  ('iai_cut', 'attack', 'slash', NULL, 3, 'one_enemy', 'front', 0.3, 0.8, NULL),
  ('mace_bash', 'attack', 'blunt', NULL, 3, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('tonfa_strike', 'attack', 'blunt', NULL, 2, 'one_enemy', 'front', 0.0, 0.8, NULL),
  ('shield_bash', 'attack', 'blunt', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('shield_block', 'guard', NULL, NULL, 2, 'self', 'any', 0.0, 0.6, 6),
  ('spear_thrust', 'attack', 'pierce', NULL, 3, 'one_enemy', 'any', 0.2, 1.0, NULL),
  ('axe_chop', 'attack', 'slash', NULL, 3, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('pick_swing', 'attack', 'pierce', NULL, 4, 'one_enemy', 'front', 0.4, 1.4, NULL),
  ('rod_whip', 'attack', 'blunt', NULL, 1, 'one_enemy', 'any', 0.1, 0.9, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('greatsword_sweep', 1, 'damage', 10, NULL::int, 1.0, '{"accuracy":0.9}'),
  ('iai_cut', 1, 'damage', 9, NULL, 1.0, '{"accuracy":1.05,"crit_bonus":0.15}'),
  ('mace_bash', 1, 'damage', 9, NULL, 1.0, '{"accuracy":0.95}'),
  ('mace_bash', 2, 'stun', 0, 1, 0.15, '{}'),
  ('tonfa_strike', 1, 'damage', 4, NULL, 1.0, '{"accuracy":1.0,"hit_count":2}'),
  ('shield_bash', 1, 'damage', 5, NULL, 1.0, '{"accuracy":1.0}'),
  ('shield_bash', 2, 'stun', 0, 1, 0.2, '{}'),
  ('shield_block', 1, 'guard', 0.6, 3, 1.0, '{"hits":2}'),
  ('spear_thrust', 1, 'damage', 9, NULL, 1.0, '{"accuracy":0.95}'),
  ('axe_chop', 1, 'damage', 10, NULL, 1.0, '{"accuracy":0.9}'),
  ('pick_swing', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.85}'),
  ('rod_whip', 1, 'damage', 3, NULL, 1.0, '{"accuracy":1.0}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
