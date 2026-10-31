-- Ring 3 creatures (pilot ladder: total core stats 30 +- 5). They never grow. Ostrich: fast kicks, hard to catch;
-- bull: charges and gores, tanky; bear: the ring's apex, mauls. Placeholder powers, tune in data.
INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule, atb_windup, atb_recovery, channel, exp_scaling)
SELECT m.move_name, m.category, d.id, NULL, 'stamina', m.cost, 'one_enemy', 'front', m.windup, m.recovery, false, 1.0
FROM (VALUES
  ('charge', 'attack', 'blunt',  6, 0.6, 1.5),
  ('gore',   'attack', 'pierce', 5, 0.3, 1.3),
  ('maul',   'attack', 'slash',  7, 0.5, 1.6)
) AS m(move_name, category, damage_type_name, cost, windup, recovery)
JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('charge', 1, 'damage',           14, NULL::int, 1.0, '{"accuracy":0.8,"hit_count":1}'),
  ('charge', 2, 'knockback',         0, NULL,      0.4, '{}'),
  ('gore',   1, 'damage',           12, NULL,      1.0, '{"accuracy":0.85,"hit_count":1}'),
  ('gore',   2, 'damage_over_time',  6, 3,         0.3, '{"status":"bleed"}'),
  ('maul',   1, 'damage',           20, NULL,      1.0, '{"accuracy":0.8,"hit_count":1}'),
  ('maul',   2, 'stun',              0, 1,         0.2, '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT DO NOTHING;

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('charge', 'body'), ('gore', 'horns'), ('maul', 'claws')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('charge', 'str', 3), ('charge', 'end', 1), ('gore', 'str', 2), ('gore', 'dex', 2), ('maul', 'str', 3), ('maul', 'end', 1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', x.tag
FROM (VALUES ('charge', 'knockback'), ('charge', 'damage'), ('gore', 'damage'), ('maul', 'stun'), ('maul', 'damage')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES
  ('charge', 'growth.heavy'), ('charge', 'melee'), ('gore', 'growth.heavy'), ('gore', 'melee'), ('maul', 'growth.heavy'), ('maul', 'melee')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;

INSERT INTO entity.species (species_name, base_stats, body_parts, ring_min, ring_max, on_expiry)
VALUES
('ostrich', '{"str":5,"dex":9,"int":2,"end":5,"luck":4,"charm":2}',   ARRAY['beak','wings','feet','body'],  3, 3, 'ignore'),
('bull',    '{"str":10,"dex":4,"int":1,"end":10,"luck":3,"charm":2}', ARRAY['horns','body','feet'],         3, 3, 'ignore'),
('bear',    '{"str":11,"dex":4,"int":3,"end":10,"luck":3,"charm":3}', ARRAY['claws','teeth','body','feet'], 3, 3, 'devour')
ON CONFLICT (species_name) DO NOTHING;

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('ostrich', 'kick'), ('ostrich', 'peck'), ('ostrich', 'wing_flap'),
  ('bull', 'charge'), ('bull', 'gore'), ('bull', 'kick'),
  ('bear', 'maul'), ('bear', 'bite'), ('bear', 'scratch')
) AS x(species_name, move_name)
JOIN entity.species s ON s.species_name = x.species_name
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;
