-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('javelin_throw','hands'), ('axe_throw','hands')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('javelin_throw','str',2), ('javelin_throw','dex',2), ('axe_throw','str',2), ('axe_throw','dex',2)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Every damaging move gives the damage interrupt tag (same rule as the unarmed seed).
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES ('javelin_throw','branch:basic'), ('javelin_throw','tier:3'), ('javelin_throw','growth.heavy'), ('axe_throw','branch:basic'), ('axe_throw','tier:2'), ('axe_throw','growth.heavy')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('javelin_throw','combo','basic_throw',10), ('javelin_throw','combo','spear_thrust',10), ('axe_throw','combo','basic_throw',5), ('axe_throw','combo','axe_chop',6)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);

-- The weapon in hand flies: a spear for the javelin, an axe for the axe throw.
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, NULL
FROM (VALUES ('javelin_throw','weapon_type','spear'), ('axe_throw','weapon_type','axe')) AS x(move_name, kind, value)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value);

-- Tree tags, and throws_weapon: the hand is empty after the throw, for the rest of the fight.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag FROM (VALUES ('javelin_throw','tree:spear'), ('javelin_throw','throws_weapon'), ('axe_throw','tree:axe'), ('axe_throw','throws_weapon')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;
