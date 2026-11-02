-- Ursine tree (docs/MOVE_TREES.md): paws, jaws, bulk and voice branches for bears.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('roar', 'control', NULL, NULL, 2, 'one_enemy', 'any', 0.1, 0.9, NULL::int),
  ('rear_up', 'buff', NULL, NULL, 2, 'self', 'any', 0.2, 0.8, NULL),
  ('swat', 'attack', 'blunt', NULL, 5, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('rend', 'attack', 'slash', NULL, 4, 'one_enemy', 'front', 0.2, 1.2, NULL),
  ('crunch', 'attack', 'pierce', NULL, 5, 'one_enemy', 'front', 0.3, 1.3, NULL),
  ('chomp', 'attack', 'pierce', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('bear_hug', 'control', 'blunt', NULL, 5, 'one_enemy', 'front', 0.3, 1.2, NULL),
  ('thick_fur', 'guard', NULL, NULL, 4, 'self', 'any', 0.0, 0.8, 8),
  ('terrifying_roar', 'control', NULL, NULL, 4, 'enemy_row', 'any', 0.3, 1.2, NULL),
  ('savage_maul', 'attack', 'slash', NULL, 7, 'one_enemy', 'front', 0.4, 1.5, NULL),
  ('bone_crusher', 'attack', 'pierce', NULL, 7, 'one_enemy', 'front', 0.6, 1.6, NULL),
  ('crushing_hug', 'attack', 'blunt', NULL, 7, 'one_enemy', 'front', 0.5, 1.5, NULL),
  ('ground_slam', 'attack', 'blunt', NULL, 8, 'all_enemies', 'front', 0.8, 1.8, NULL),
  ('lick_wounds', 'heal', NULL, NULL, 5, 'self', 'any', 0.6, 1.5, 14),
  ('berserk_frenzy', 'attack', 'slash', NULL, 10, 'one_enemy', 'front', 0.6, 1.9, NULL),
  ('unstoppable', 'attack', 'blunt', NULL, 11, 'one_enemy', 'any', 1.0, 2.0, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('roar', 1, 'taunt', 0, 2::int, 0.8, '{}'),
  ('rear_up', 1, 'buff', 0, 3, 1.0, '{"stat":"critChance","add":0.1}'),
  ('swat', 1, 'damage', 14, NULL, 1.0, '{"accuracy":0.9}'),
  ('swat', 2, 'knockback', 0, NULL, 0.5, '{}'),
  ('rend', 1, 'damage', 10, NULL, 1.0, '{"accuracy":0.9}'),
  ('rend', 2, 'damage_over_time', 5, 3, 0.45, '{"status":"bleed"}'),
  ('crunch', 1, 'damage', 14, NULL, 1.0, '{"accuracy":0.9}'),
  ('chomp', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.95,"hit_count":2}'),
  ('bear_hug', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.9}'),
  ('bear_hug', 2, 'bind', 0, 2, 0.7, '{}'),
  ('thick_fur', 1, 'guard', 0.5, 3, 1.0, '{"hits":2}'),
  ('terrifying_roar', 1, 'debuff', 0, 2, 0.7, '{"stat":"speed","mult":0.8}'),
  ('savage_maul', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.9,"hit_count":3}'),
  ('savage_maul', 2, 'damage_over_time', 6, 3, 0.5, '{"status":"bleed"}'),
  ('bone_crusher', 1, 'damage', 24, NULL, 1.0, '{"accuracy":0.85}'),
  ('bone_crusher', 2, 'stun', 0, 1, 0.3, '{}'),
  ('crushing_hug', 1, 'damage', 18, NULL, 1.0, '{"accuracy":0.9,"bonus_vs_effect":"bind","bonus_mult":1.6}'),
  ('crushing_hug', 2, 'bind', 0, 2, 0.6, '{}'),
  ('ground_slam', 1, 'damage', 9, NULL, 1.0, '{"accuracy":0.9}'),
  ('ground_slam', 2, 'stun', 0, 1, 0.25, '{}'),
  ('lick_wounds', 1, 'heal_over_time', 14, 3, 1.0, '{}'),
  ('berserk_frenzy', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.9,"hit_count":4}'),
  ('berserk_frenzy', 2, 'damage_over_time', 7, 3, 0.5, '{"status":"bleed"}'),
  ('unstoppable', 1, 'damage', 32, NULL, 1.0, '{"accuracy":0.85}'),
  ('unstoppable', 2, 'knockback', 0, NULL, 0.6, '{}'),
  ('unstoppable', 3, 'stun', 0, 1, 0.3, '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
