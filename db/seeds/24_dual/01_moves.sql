-- Dual knife moves (docs/MOVE_TREES.md): need the Dual Wielder trait to hold the second knife.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('twin_stab', 'attack', 'pierce', NULL, 3, 'one_enemy', 'front', 0.0, 0.9, NULL::int),
  ('cross_cut', 'attack', 'slash', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('offhand_feint', 'control', 'pierce', NULL, 3, 'one_enemy', 'front', 0.0, 0.8, NULL),
  ('blade_guard', 'guard', NULL, NULL, 3, 'self', 'any', 0.0, 0.7, 8),
  ('scissor_strike', 'attack', 'slash', NULL, 6, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('twin_riposte', 'guard', 'pierce', NULL, 4, 'self', 'any', 0.1, 0.6, 8),
  ('whirling_blades', 'attack', 'slash', NULL, 6, 'enemy_row', 'front', 0.3, 1.3, NULL),
  ('flurry_of_steel', 'attack', 'pierce', NULL, 6, 'one_enemy', 'front', 0.2, 1.3, NULL),
  ('dancing_steel', 'buff', NULL, NULL, 4, 'self', 'any', 0.0, 0.7, 10),
  ('twin_cleave', 'attack', 'slash', NULL, 9, 'one_enemy', 'front', 0.6, 1.7, NULL),
  ('thousand_cuts', 'attack', 'slash', NULL, 10, 'one_enemy', 'front', 0.5, 1.8, NULL),
  ('crimson_waltz', 'attack', 'slash', NULL, 11, 'all_enemies', 'front', 0.6, 1.9, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('twin_stab', 1, 'damage', 5, NULL::int, 1.0, '{"accuracy":1.05,"hit_count":2,"hands":"each"}'),
  ('cross_cut', 1, 'damage', 10, NULL, 1.0, '{"accuracy":1.0,"hands":"sum"}'),
  ('cross_cut', 2, 'damage_over_time', 4, 3, 0.35, '{"status":"bleed"}'),
  ('offhand_feint', 1, 'damage', 3, NULL, 1.0, '{"accuracy":1.1,"hit_count":2,"hands":"each"}'),
  ('offhand_feint', 2, 'debuff', 0, 2, 0.75, '{"stat":"dodgeChance","mult":0.5}'),
  ('blade_guard', 1, 'guard', 0.4, 3, 1.0, '{"hits":2}'),
  ('scissor_strike', 1, 'damage', 15, NULL, 1.0, '{"accuracy":0.95,"hands":"sum","crit_bonus":0.15}'),
  ('scissor_strike', 2, 'damage_over_time', 6, 3, 0.5, '{"status":"bleed"}'),
  ('twin_riposte', 1, 'counter', 10, 3, 1.0, '{"trigger":"hit","tags":["melee"],"take":0.5,"momentum":0.3,"accuracy":1.15,"hit_count":2,"hands":"each"}'),
  ('whirling_blades', 1, 'damage', 6, NULL, 1.0, '{"accuracy":0.9,"hit_count":2,"hands":"each"}'),
  ('flurry_of_steel', 1, 'damage', 4, NULL, 1.0, '{"accuracy":0.95,"hit_count":4,"hands":"each"}'),
  ('dancing_steel', 1, 'buff', 0, 3, 1.0, '{"stat":"dodgeChance","add":0.15}'),
  ('dancing_steel', 2, 'buff', 0, 3, 1.0, '{"stat":"speed","mult":1.15}'),
  ('twin_cleave', 1, 'damage', 26, NULL, 1.0, '{"accuracy":0.9,"hands":"sum"}'),
  ('twin_cleave', 2, 'knockback', 0, NULL, 0.3, '{}'),
  ('thousand_cuts', 1, 'damage', 3, NULL, 1.0, '{"accuracy":0.95,"hit_count":8,"hands":"each"}'),
  ('thousand_cuts', 2, 'damage_over_time', 6, 3, 0.6, '{"status":"bleed"}'),
  ('crimson_waltz', 1, 'damage', 6, NULL, 1.0, '{"accuracy":0.9,"hit_count":2,"hands":"each"}'),
  ('crimson_waltz', 2, 'damage_over_time', 5, 3, 0.5, '{"status":"bleed"}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
