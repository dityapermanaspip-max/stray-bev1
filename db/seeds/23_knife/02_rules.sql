-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('flick_stab','hands'), ('lunge','hands'), ('puncture','hands'), ('heartseeker','hands'), ('slice','hands'), ('hamstring','hands'), ('flay','hands'), ('fan_slash','hands'), ('tendon_cut','hands'), ('joint_cut','hands'), ('cleave','hands'), ('butchers_eye','hands'), ('carve','hands'), ('feint','hands'), ('dirty_trick','hands'), ('backstab','hands'), ('throat_slit','hands'), ('knife_parry','hands'), ('reverse_grip','hands'), ('riposte','hands')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('flick_stab','dex',3), ('flick_stab','luck',1), ('lunge','dex',2), ('lunge','str',2), ('puncture','dex',2), ('puncture','str',2), ('heartseeker','dex',3), ('heartseeker','luck',1), ('slice','dex',3), ('slice','str',1), ('hamstring','dex',3), ('hamstring','int',1), ('flay','dex',2), ('flay','str',2), ('fan_slash','dex',3), ('fan_slash','str',1), ('tendon_cut','dex',3), ('tendon_cut','int',1), ('joint_cut','str',2), ('joint_cut','dex',2), ('cleave','str',3), ('cleave','end',1), ('butchers_eye','dex',2), ('butchers_eye','int',2), ('carve','str',2), ('carve','dex',2), ('feint','dex',2), ('feint','int',2), ('dirty_trick','int',2), ('dirty_trick','luck',2), ('backstab','dex',3), ('backstab','luck',1), ('throat_slit','dex',3), ('throat_slit','luck',1), ('knife_parry','dex',3), ('knife_parry','end',1), ('reverse_grip','dex',3), ('reverse_grip','luck',1), ('riposte','dex',2), ('riposte','end',2)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('dirty_trick','gives','stun')) AS x(move_name, role, tag)
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
FROM (VALUES ('flick_stab','tree:knife'), ('flick_stab','branch:thrust'), ('flick_stab','tier:2'), ('flick_stab','growth.quick'), ('flick_stab','melee'), ('lunge','tree:knife'), ('lunge','branch:thrust'), ('lunge','tier:2'), ('lunge','growth.quick'), ('lunge','melee'), ('puncture','tree:knife'), ('puncture','branch:thrust'), ('puncture','tier:3'), ('puncture','growth.heavy'), ('puncture','melee'), ('heartseeker','tree:knife'), ('heartseeker','branch:thrust'), ('heartseeker','tier:4'), ('heartseeker','growth.heavy'), ('heartseeker','melee'), ('slice','tree:knife'), ('slice','branch:cut'), ('slice','tier:2'), ('slice','growth.quick'), ('slice','melee'), ('hamstring','tree:knife'), ('hamstring','branch:cut'), ('hamstring','tier:2'), ('hamstring','growth.quick'), ('hamstring','melee'), ('flay','tree:knife'), ('flay','branch:cut'), ('flay','tier:3'), ('flay','growth.quick'), ('flay','melee'), ('fan_slash','tree:knife'), ('fan_slash','branch:cut'), ('fan_slash','tier:3'), ('fan_slash','growth.quick'), ('fan_slash','melee'), ('tendon_cut','tree:knife'), ('tendon_cut','branch:cut'), ('tendon_cut','tier:3'), ('tendon_cut','growth.quick'), ('tendon_cut','melee'), ('joint_cut','tree:knife'), ('joint_cut','branch:butcher'), ('joint_cut','tier:2'), ('joint_cut','growth.heavy'), ('joint_cut','melee'), ('cleave','tree:knife'), ('cleave','branch:butcher'), ('cleave','tier:2'), ('cleave','growth.heavy'), ('cleave','melee'), ('butchers_eye','tree:knife'), ('butchers_eye','branch:butcher'), ('butchers_eye','tier:3'), ('butchers_eye','growth.heavy'), ('butchers_eye','melee'), ('carve','tree:knife'), ('carve','branch:butcher'), ('carve','tier:4'), ('carve','growth.heavy'), ('carve','melee'), ('feint','tree:knife'), ('feint','branch:trick'), ('feint','tier:2'), ('feint','growth.quick'), ('feint','melee'), ('dirty_trick','tree:knife'), ('dirty_trick','branch:trick'), ('dirty_trick','tier:2'), ('dirty_trick','growth.quick'), ('dirty_trick','melee'), ('backstab','tree:knife'), ('backstab','branch:trick'), ('backstab','tier:3'), ('backstab','growth.quick'), ('backstab','melee'), ('throat_slit','tree:knife'), ('throat_slit','branch:trick'), ('throat_slit','tier:4'), ('throat_slit','growth.quick'), ('throat_slit','melee'), ('knife_parry','tree:knife'), ('knife_parry','branch:guard'), ('knife_parry','tier:2'), ('knife_parry','growth.guard'), ('reverse_grip','tree:knife'), ('reverse_grip','branch:guard'), ('reverse_grip','tier:2'), ('reverse_grip','growth.guard'), ('riposte','tree:knife'), ('riposte','branch:guard'), ('riposte','tier:3'), ('riposte','growth.guard')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('flick_stab','mastery','knife_stab',5), ('lunge','mastery','knife_stab',7), ('puncture','mastery','lunge',10), ('heartseeker','mastery','puncture',13), ('slice','mastery','knife_stab',4), ('hamstring','mastery','slice',7), ('flay','mastery','slice',10), ('fan_slash','mastery','slice',10), ('tendon_cut','mastery','hamstring',10), ('joint_cut','mastery','knife_stab',8), ('cleave','mastery','knife_stab',9), ('butchers_eye','combo','knife_stab',10), ('butchers_eye','combo','butchery',10), ('carve','combo','butchers_eye',13), ('carve','combo','butchery',15), ('feint','mastery','knife_stab',6), ('dirty_trick','mastery','knife_stab',7), ('backstab','mastery','feint',10), ('throat_slit','combo','backstab',13), ('throat_slit','combo','flay',10), ('knife_parry','mastery','knife_stab',6), ('reverse_grip','mastery','knife_parry',8), ('riposte','mastery','knife_parry',10)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);

-- Every knife move needs a knife in hand.
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, NULL
FROM (VALUES ('flick_stab','weapon_type','knife'), ('lunge','weapon_type','knife'), ('puncture','weapon_type','knife'), ('heartseeker','weapon_type','knife'), ('slice','weapon_type','knife'), ('hamstring','weapon_type','knife'), ('flay','weapon_type','knife'), ('fan_slash','weapon_type','knife'), ('tendon_cut','weapon_type','knife'), ('joint_cut','weapon_type','knife'), ('cleave','weapon_type','knife'), ('butchers_eye','weapon_type','knife'), ('carve','weapon_type','knife'), ('feint','weapon_type','knife'), ('dirty_trick','weapon_type','knife'), ('backstab','weapon_type','knife'), ('throat_slit','weapon_type','knife'), ('knife_parry','weapon_type','knife'), ('reverse_grip','weapon_type','knife'), ('riposte','weapon_type','knife')) AS x(move_name, kind, value)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value);
