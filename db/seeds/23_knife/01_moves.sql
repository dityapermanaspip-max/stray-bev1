-- Knife tree (docs/MOVE_TREES.md): thrust, cut, butcher's craft, trickery and guard, all rooted in Stab.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('flick_stab', 'attack', 'pierce', NULL, 2, 'one_enemy', 'front', 0.0, 0.6, NULL::int),
  ('lunge', 'attack', 'pierce', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('puncture', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.3, 1.2, NULL),
  ('heartseeker', 'attack', 'pierce', NULL, 8, 'one_enemy', 'front', 0.5, 1.6, NULL),
  ('slice', 'attack', 'slash', NULL, 2, 'one_enemy', 'front', 0.0, 0.8, NULL),
  ('hamstring', 'control', 'slash', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('flay', 'attack', 'slash', NULL, 5, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('fan_slash', 'attack', 'slash', NULL, 5, 'enemy_row', 'front', 0.3, 1.3, NULL),
  ('tendon_cut', 'control', 'slash', NULL, 6, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('joint_cut', 'control', 'slash', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('cleave', 'attack', 'slash', NULL, 5, 'one_enemy', 'front', 0.4, 1.4, NULL),
  ('butchers_eye', 'attack', 'slash', NULL, 5, 'one_enemy', 'front', 0.3, 1.2, NULL),
  ('carve', 'attack', 'slash', NULL, 8, 'one_enemy', 'front', 0.5, 1.6, NULL),
  ('feint', 'control', NULL, NULL, 2, 'one_enemy', 'front', 0.0, 0.6, NULL),
  ('dirty_trick', 'control', NULL, NULL, 3, 'one_enemy', 'front', 0.1, 0.9, 8),
  ('backstab', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('throat_slit', 'attack', 'slash', NULL, 8, 'one_enemy', 'front', 0.4, 1.5, NULL),
  ('knife_parry', 'guard', NULL, NULL, 2, 'self', 'any', 0.0, 0.6, 6),
  ('reverse_grip', 'buff', NULL, NULL, 2, 'self', 'any', 0.0, 0.6, 8),
  ('riposte', 'guard', 'pierce', NULL, 3, 'self', 'any', 0.1, 0.6, 8)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('flick_stab', 1, 'damage', 5, NULL::int, 1.0, '{"accuracy":1.15}'),
  ('lunge', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.95}'),
  ('puncture', 1, 'damage', 16, NULL, 1.0, '{"accuracy":0.95,"crit_bonus":0.1}'),
  ('puncture', 2, 'damage_over_time', 5, 3, 0.4, '{"status":"bleed"}'),
  ('heartseeker', 1, 'damage', 26, NULL, 1.0, '{"accuracy":0.9,"crit_bonus":0.3}'),
  ('slice', 1, 'damage', 6, NULL, 1.0, '{"accuracy":1.0}'),
  ('slice', 2, 'damage_over_time', 3, 2, 0.35, '{"status":"bleed"}'),
  ('hamstring', 1, 'damage', 5, NULL, 1.0, '{"accuracy":0.95}'),
  ('hamstring', 2, 'debuff', 0, 2, 0.7, '{"stat":"speed","mult":0.75}'),
  ('flay', 1, 'damage', 9, NULL, 1.0, '{"accuracy":0.95}'),
  ('flay', 2, 'damage_over_time', 7, 3, 0.6, '{"status":"bleed"}'),
  ('fan_slash', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.9}'),
  ('fan_slash', 2, 'damage_over_time', 3, 2, 0.3, '{"status":"bleed"}'),
  ('tendon_cut', 1, 'damage', 10, NULL, 1.0, '{"accuracy":0.95}'),
  ('tendon_cut', 2, 'debuff', 0, 3, 0.8, '{"stat":"speed","mult":0.6}'),
  ('tendon_cut', 3, 'damage_over_time', 4, 3, 0.4, '{"status":"bleed"}'),
  ('joint_cut', 1, 'damage', 9, NULL, 1.0, '{"accuracy":0.95}'),
  ('joint_cut', 2, 'debuff', 0, 2, 0.6, '{"stat":"accuracy","mult":0.8}'),
  ('cleave', 1, 'damage', 15, NULL, 1.0, '{"accuracy":0.9}'),
  ('butchers_eye', 1, 'damage', 14, NULL, 1.0, '{"accuracy":1.0,"crit_bonus":0.25}'),
  ('carve', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.95,"hit_count":3}'),
  ('carve', 2, 'damage_over_time', 8, 3, 0.6, '{"status":"bleed"}'),
  ('feint', 1, 'debuff', 0, 2, 0.8, '{"stat":"dodgeChance","mult":0.5}'),
  ('dirty_trick', 1, 'debuff', 0, 2, 0.7, '{"stat":"accuracy","mult":0.7}'),
  ('dirty_trick', 2, 'stun', 0, 1, 0.2, '{}'),
  ('backstab', 1, 'damage', 14, NULL, 1.0, '{"accuracy":1.0,"crit_bonus":0.2,"bonus_vs_effect":"taunt","bonus_mult":1.6}'),
  ('throat_slit', 1, 'damage', 20, NULL, 1.0, '{"accuracy":0.95,"crit_bonus":0.2}'),
  ('throat_slit', 2, 'damage_over_time', 8, 3, 0.6, '{"status":"bleed"}'),
  ('throat_slit', 3, 'silence', 0, 2, 0.4, '{}'),
  ('knife_parry', 1, 'guard', 0.5, 2, 1.0, '{"hits":1}'),
  ('reverse_grip', 1, 'buff', 0, 3, 1.0, '{"stat":"critChance","add":0.12}'),
  ('reverse_grip', 2, 'buff', 0, 3, 1.0, '{"stat":"speed","mult":1.1}'),
  ('riposte', 1, 'counter', 12, 3, 1.0, '{"trigger":"hit","tags":["melee"],"take":0.5,"momentum":0.3,"accuracy":1.15,"crit_bonus":0.15}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
