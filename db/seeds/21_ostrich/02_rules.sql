-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('sprint','feet'), ('long_stride','feet'), ('talon_kick','feet'), ('gutting_kick','feet'), ('dust_trail','feet'), ('thunder_kick','feet')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('sprint','dex',3), ('sprint','end',1), ('long_stride','dex',3), ('long_stride','luck',1), ('talon_kick','str',3), ('talon_kick','dex',1), ('gutting_kick','str',3), ('gutting_kick','luck',1), ('dust_trail','dex',2), ('dust_trail','int',2), ('thunder_kick','str',3), ('thunder_kick','end',1)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('thunder_kick','gives','knockback'), ('thunder_kick','gives','stun')) AS x(move_name, role, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Every damaging move gives the damage interrupt tag (same rule as the unarmed seed).
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES ('sprint','tree:fowl'), ('sprint','branch:strider'), ('sprint','tier:1'), ('sprint','growth.quick'), ('long_stride','tree:fowl'), ('long_stride','branch:strider'), ('long_stride','tier:2'), ('long_stride','growth.guard'), ('talon_kick','tree:fowl'), ('talon_kick','branch:strider'), ('talon_kick','tier:2'), ('talon_kick','growth.heavy'), ('talon_kick','melee'), ('gutting_kick','tree:fowl'), ('gutting_kick','branch:strider'), ('gutting_kick','tier:3'), ('gutting_kick','growth.heavy'), ('gutting_kick','melee'), ('dust_trail','tree:fowl'), ('dust_trail','branch:strider'), ('dust_trail','tier:3'), ('dust_trail','growth.quick'), ('thunder_kick','tree:fowl'), ('thunder_kick','branch:strider'), ('thunder_kick','tier:4'), ('thunder_kick','growth.heavy'), ('thunder_kick','melee')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('long_stride','mastery','sprint',6), ('talon_kick','mastery','sprint',7), ('gutting_kick','mastery','talon_kick',10), ('dust_trail','mastery','long_stride',10), ('thunder_kick','mastery','gutting_kick',13)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);
