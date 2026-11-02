-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('twin_stab','hands'), ('cross_cut','hands'), ('offhand_feint','hands'), ('blade_guard','hands'), ('scissor_strike','hands'), ('twin_riposte','hands'), ('whirling_blades','hands'), ('flurry_of_steel','hands'), ('dancing_steel','hands'), ('twin_cleave','hands'), ('thousand_cuts','hands'), ('crimson_waltz','hands')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('twin_stab','dex',3), ('twin_stab','str',1), ('cross_cut','dex',2), ('cross_cut','str',2), ('offhand_feint','dex',2), ('offhand_feint','int',2), ('blade_guard','dex',2), ('blade_guard','end',2), ('scissor_strike','dex',2), ('scissor_strike','str',2), ('twin_riposte','dex',2), ('twin_riposte','end',2), ('whirling_blades','dex',3), ('whirling_blades','end',1), ('flurry_of_steel','dex',3), ('flurry_of_steel','luck',1), ('dancing_steel','dex',3), ('dancing_steel','luck',1), ('twin_cleave','str',3), ('twin_cleave','dex',1), ('thousand_cuts','dex',3), ('thousand_cuts','luck',1), ('crimson_waltz','dex',3), ('crimson_waltz','end',1)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('twin_cleave','gives','knockback')) AS x(move_name, role, tag)
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
FROM (VALUES ('twin_stab','tree:knife'), ('twin_stab','branch:dual'), ('twin_stab','tier:1'), ('twin_stab','growth.quick'), ('twin_stab','melee'), ('cross_cut','tree:knife'), ('cross_cut','branch:dual'), ('cross_cut','tier:2'), ('cross_cut','growth.quick'), ('cross_cut','melee'), ('offhand_feint','tree:knife'), ('offhand_feint','branch:dual'), ('offhand_feint','tier:2'), ('offhand_feint','growth.quick'), ('offhand_feint','melee'), ('blade_guard','tree:knife'), ('blade_guard','branch:dual'), ('blade_guard','tier:2'), ('blade_guard','growth.guard'), ('scissor_strike','tree:knife'), ('scissor_strike','branch:dual'), ('scissor_strike','tier:3'), ('scissor_strike','growth.heavy'), ('scissor_strike','melee'), ('twin_riposte','tree:knife'), ('twin_riposte','branch:dual'), ('twin_riposte','tier:3'), ('twin_riposte','growth.guard'), ('whirling_blades','tree:knife'), ('whirling_blades','branch:dual'), ('whirling_blades','tier:3'), ('whirling_blades','growth.quick'), ('whirling_blades','melee'), ('flurry_of_steel','tree:knife'), ('flurry_of_steel','branch:dual'), ('flurry_of_steel','tier:3'), ('flurry_of_steel','growth.quick'), ('flurry_of_steel','melee'), ('dancing_steel','tree:knife'), ('dancing_steel','branch:dual'), ('dancing_steel','tier:3'), ('dancing_steel','growth.guard'), ('twin_cleave','tree:knife'), ('twin_cleave','branch:dual'), ('twin_cleave','tier:4'), ('twin_cleave','growth.heavy'), ('twin_cleave','melee'), ('thousand_cuts','tree:knife'), ('thousand_cuts','branch:dual'), ('thousand_cuts','tier:4'), ('thousand_cuts','growth.quick'), ('thousand_cuts','melee'), ('crimson_waltz','tree:knife'), ('crimson_waltz','branch:dual'), ('crimson_waltz','tier:4'), ('crimson_waltz','growth.quick'), ('crimson_waltz','melee')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('cross_cut','mastery','twin_stab',6), ('offhand_feint','mastery','twin_stab',7), ('blade_guard','combo','twin_stab',7), ('blade_guard','combo','knife_parry',6), ('scissor_strike','mastery','cross_cut',10), ('twin_riposte','combo','blade_guard',10), ('twin_riposte','combo','riposte',8), ('whirling_blades','mastery','twin_stab',10), ('flurry_of_steel','mastery','offhand_feint',10), ('dancing_steel','combo','whirling_blades',8), ('dancing_steel','combo','reverse_grip',8), ('twin_cleave','combo','scissor_strike',13), ('twin_cleave','combo','cleave',10), ('thousand_cuts','mastery','flurry_of_steel',13), ('crimson_waltz','combo','dancing_steel',13), ('crimson_waltz','combo','whirling_blades',13)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);

-- A knife in each hand: the main hand (weapon_type) and the off hand (off_hand_type).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, NULL
FROM (VALUES ('twin_stab','weapon_type','knife'), ('twin_stab','off_hand_type','knife'), ('cross_cut','weapon_type','knife'), ('cross_cut','off_hand_type','knife'), ('offhand_feint','weapon_type','knife'), ('offhand_feint','off_hand_type','knife'), ('blade_guard','weapon_type','knife'), ('blade_guard','off_hand_type','knife'), ('scissor_strike','weapon_type','knife'), ('scissor_strike','off_hand_type','knife'), ('twin_riposte','weapon_type','knife'), ('twin_riposte','off_hand_type','knife'), ('whirling_blades','weapon_type','knife'), ('whirling_blades','off_hand_type','knife'), ('flurry_of_steel','weapon_type','knife'), ('flurry_of_steel','off_hand_type','knife'), ('dancing_steel','weapon_type','knife'), ('dancing_steel','off_hand_type','knife'), ('twin_cleave','weapon_type','knife'), ('twin_cleave','off_hand_type','knife'), ('thousand_cuts','weapon_type','knife'), ('thousand_cuts','off_hand_type','knife'), ('crimson_waltz','weapon_type','knife'), ('crimson_waltz','off_hand_type','knife')) AS x(move_name, kind, value)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value);

-- Every knife teaches Twin Stab the first time it is held as a second knife.
UPDATE item.items SET data = jsonb_set(data, '{wield,off_grants_move}', '"twin_stab"')
WHERE data->'wield'->>'weapon_type' = 'knife' AND NOT (data->'wield' ? 'off_grants_move');
