-- Reptile tree (docs/MOVE_TREES.md): jaws, tail, claws, scales and voice branches for lizards.
-- Generated from a move spec; numbers are placeholders to tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, m.category, d.id, m.element, 'stamina', m.cost, m.target, m.row_rule, m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('scurry', 'buff', NULL, NULL, 2, 'self', 'any', 0.0, 0.6, NULL::int),
  ('claw_rake', 'attack', 'slash', NULL, 2, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('bask', 'heal', NULL, NULL, 3, 'self', 'any', 0.5, 1.3, 10),
  ('snap_bite', 'attack', 'pierce', NULL, 3, 'one_enemy', 'front', 0.0, 0.8, NULL),
  ('lockjaw', 'control', 'pierce', NULL, 4, 'one_enemy', 'front', 0.2, 1.1, NULL),
  ('tail_sweep', 'attack', 'blunt', NULL, 4, 'enemy_row', 'front', 0.3, 1.3, NULL),
  ('tail_drop', 'buff', NULL, NULL, 2, 'self', 'any', 0.0, 0.5, 10),
  ('tear', 'attack', 'slash', NULL, 3, 'one_enemy', 'front', 0.1, 1.0, NULL),
  ('harden_scales', 'guard', NULL, NULL, 3, 'self', 'any', 0.0, 0.8, 8),
  ('frill_flare', 'control', NULL, NULL, 3, 'enemy_row', 'any', 0.2, 1.0, NULL),
  ('death_roll', 'attack', 'pierce', NULL, 6, 'one_enemy', 'front', 0.5, 1.5, NULL),
  ('crushing_jaws', 'attack', 'pierce', NULL, 6, 'one_enemy', 'front', 0.5, 1.5, NULL),
  ('club_tail', 'attack', 'blunt', NULL, 6, 'one_enemy', 'front', 0.5, 1.5, NULL),
  ('gut_rake', 'attack', 'slash', NULL, 6, 'one_enemy', 'front', 0.3, 1.4, NULL),
  ('stone_scales', 'guard', NULL, NULL, 5, 'self', 'any', 0.0, 0.9, 10),
  ('primal_bite', 'attack', 'pierce', NULL, 9, 'one_enemy', 'front', 0.6, 1.8, NULL),
  ('thrash', 'attack', 'blunt', NULL, 10, 'enemy_row', 'front', 0.7, 1.9, NULL)
) AS m(move_name, category, damage_type_name, element, cost, target, row_rule, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('scurry', 1, 'buff', 0, 2::int, 1.0, '{"stat":"dodgeChance","add":0.12}'),
  ('claw_rake', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.95}'),
  ('claw_rake', 2, 'damage_over_time', 3, 2, 0.2, '{"status":"bleed"}'),
  ('bask', 1, 'heal_over_time', 6, 3, 1.0, '{}'),
  ('snap_bite', 1, 'damage', 9, NULL, 1.0, '{"accuracy":1.15}'),
  ('lockjaw', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.95}'),
  ('lockjaw', 2, 'bind', 0, 2, 0.6, '{}'),
  ('tail_sweep', 1, 'damage', 7, NULL, 1.0, '{"accuracy":0.9}'),
  ('tail_sweep', 2, 'knockback', 0, NULL, 0.3, '{}'),
  ('tail_drop', 1, 'buff', 0, 1, 1.0, '{"stat":"dodgeChance","add":0.35}'),
  ('tear', 1, 'damage', 8, NULL, 1.0, '{"accuracy":0.95}'),
  ('tear', 2, 'damage_over_time', 5, 3, 0.45, '{"status":"bleed"}'),
  ('harden_scales', 1, 'guard', 0.5, 3, 1.0, '{"hits":2}'),
  ('frill_flare', 1, 'debuff', 0, 2, 0.7, '{"stat":"accuracy","mult":0.75}'),
  ('death_roll', 1, 'damage', 16, NULL, 1.0, '{"accuracy":0.9,"bonus_vs_effect":"bind","bonus_mult":1.5}'),
  ('death_roll', 2, 'bind', 0, 1, 0.5, '{}'),
  ('crushing_jaws', 1, 'damage', 20, NULL, 1.0, '{"accuracy":0.85}'),
  ('crushing_jaws', 2, 'stun', 0, 1, 0.3, '{}'),
  ('club_tail', 1, 'damage', 18, NULL, 1.0, '{"accuracy":0.85}'),
  ('club_tail', 2, 'knockback', 0, NULL, 0.5, '{}'),
  ('gut_rake', 1, 'damage', 6, NULL, 1.0, '{"accuracy":0.9,"hit_count":3}'),
  ('gut_rake', 2, 'damage_over_time', 5, 3, 0.5, '{"status":"bleed"}'),
  ('stone_scales', 1, 'guard', 0.35, 3, 1.0, '{"hits":3}'),
  ('primal_bite', 1, 'damage', 30, NULL, 1.0, '{"accuracy":0.85,"crit_bonus":0.2}'),
  ('primal_bite', 2, 'damage_over_time', 7, 3, 0.5, '{"status":"bleed"}'),
  ('thrash', 1, 'damage', 14, NULL, 1.0, '{"accuracy":0.85,"hit_count":2}'),
  ('thrash', 2, 'knockback', 0, NULL, 0.4, '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;
