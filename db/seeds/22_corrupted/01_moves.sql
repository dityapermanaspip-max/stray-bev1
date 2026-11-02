-- Corrupted-only moves: open from the start, rolled only by corrupted creatures (species_moves.corrupted_only).
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('rot_peck', 'attack', 'pierce', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL::int),
  ('dread_squawk', 'control', NULL, NULL, 4, 'all_enemies', 'any', 0.3, 1.2, NULL),
  ('blight_spur', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('mad_dash', 'buff', NULL, NULL, 3, 'self', 'any', 0.0, 0.6, 8),
  ('brimstone_breath', 'attack', 'force', 'fire', 7, 'enemy_row', 'any', 0.6, 1.6, NULL),
  ('plague_claws', 'attack', 'slash', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('night_terror', 'control', NULL, NULL, 5, 'one_enemy', 'any', 0.4, 1.2, 8),
  ('hollow_bite', 'attack', 'pierce', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('rotting_horns', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('black_stampede', 'attack', 'blunt', NULL, 8, 'enemy_row', 'any', 0.8, 1.8, NULL),
  ('mad_bellow', 'control', NULL, NULL, 5, 'all_enemies', 'any', 0.3, 1.2, 10),
  ('venom_bite', 'attack', 'pierce', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('bile_spit', 'attack', 'poison', NULL, 4, 'one_enemy', 'any', 0.3, 1.2, NULL),
  ('cold_blood', 'buff', NULL, NULL, 4, 'self', 'any', 0.2, 0.9, 10),
  ('rabid_bite', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('blood_frenzy', 'buff', NULL, NULL, 5, 'self', 'any', 0.2, 0.9, 12),
  ('carrion_roar', 'control', NULL, NULL, 6, 'all_enemies', 'any', 0.4, 1.3, 10)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('rot_peck', 1, 'damage', 6, NULL::int, 1.0, '{"accuracy":1.0}'),
  ('rot_peck', 2, 'damage_over_time', 5, 3, 0.5, '{"status":"poison"}'),
  ('dread_squawk', 1, 'debuff', 0, 2, 0.7, '{"stat":"speed","mult":0.8}'),
  ('blight_spur', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.9}'),
  ('blight_spur', 2, 'damage_over_time', 6, 3, 0.6, '{"status":"poison"}'),
  ('mad_dash', 1, 'buff', 0, 3, 1.0, '{"stat":"speed","mult":1.35}'),
  ('brimstone_breath', 1, 'damage', 10, NULL, 1.0, '{"accuracy":0.9}'),
  ('brimstone_breath', 2, 'damage_over_time', 5, 3, 0.5, '{"status":"burn"}'),
  ('brimstone_breath', 3, 'damage_over_time', 4, 3, 0.4, '{"status":"poison"}'),
  ('plague_claws', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.95}'),
  ('plague_claws', 2, 'damage_over_time', 5, 3, 0.6, '{"status":"poison"}'),
  ('night_terror', 1, 'stun', 0, 1, 0.35, '{}'),
  ('night_terror', 2, 'debuff', 0, 2, 0.7, '{"stat":"accuracy","mult":0.7}'),
  ('hollow_bite', 1, 'damage', 10, NULL, 1.0, '{"accuracy":0.9}'),
  ('hollow_bite', 2, 'drain', 0, NULL, 1.0, '{"share":0.15}'),
  ('rotting_horns', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.9}'),
  ('rotting_horns', 2, 'damage_over_time', 6, 3, 0.6, '{"status":"poison"}'),
  ('black_stampede', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.85}'),
  ('black_stampede', 2, 'damage_over_time', 5, 3, 0.4, '{"status":"poison"}'),
  ('black_stampede', 3, 'knockback', 0, NULL, 0.3, '{}'),
  ('mad_bellow', 1, 'taunt', 0, 2, 0.9, '{}'),
  ('mad_bellow', 2, 'buff', 0, 3, 1.0, '{"stat":"critChance","self":true,"add":0.2}'),
  ('venom_bite', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.95}'),
  ('venom_bite', 2, 'damage_over_time', 6, 3, 0.6, '{"status":"poison"}'),
  ('bile_spit', 1, 'damage_over_time', 8, 3, 0.7, '{"status":"poison"}'),
  ('bile_spit', 2, 'debuff', 0, 2, 0.6, '{"stat":"accuracy","mult":0.75}'),
  ('cold_blood', 1, 'buff', 0, 3, 1.0, '{"stat":"critChance","add":0.2}'),
  ('rabid_bite', 1, 'damage', 12, NULL, 1.0, '{"accuracy":0.9}'),
  ('rabid_bite', 2, 'damage_over_time', 6, 3, 0.6, '{"status":"poison"}'),
  ('blood_frenzy', 1, 'buff', 0, 3, 1.0, '{"stat":"speed","mult":1.3}'),
  ('blood_frenzy', 2, 'buff', 0, 3, 1.0, '{"stat":"critChance","add":0.15}'),
  ('carrion_roar', 1, 'taunt', 0, 2, 0.8, '{}'),
  ('carrion_roar', 2, 'debuff', 0, 2, 0.6, '{"stat":"accuracy","mult":0.75}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
