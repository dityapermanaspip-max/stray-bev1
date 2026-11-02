-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('greatsword_sweep','hands'), ('iai_cut','hands'), ('mace_bash','hands'), ('tonfa_strike','hands'), ('shield_bash','hands'), ('shield_block','hands'), ('spear_thrust','hands'), ('axe_chop','hands'), ('pick_swing','hands'), ('rod_whip','hands')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('greatsword_sweep','str',3), ('greatsword_sweep','end',1), ('iai_cut','dex',3), ('iai_cut','str',1), ('mace_bash','str',3), ('mace_bash','end',1), ('tonfa_strike','dex',2), ('tonfa_strike','end',2), ('shield_bash','end',3), ('shield_bash','str',1), ('shield_block','end',4), ('spear_thrust','str',2), ('spear_thrust','dex',2), ('axe_chop','str',3), ('axe_chop','dex',1), ('pick_swing','str',3), ('pick_swing','end',1), ('rod_whip','dex',2), ('rod_whip','luck',2)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('mace_bash','gives','stun'), ('shield_bash','gives','stun')) AS x(move_name, role, tag)
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
FROM (VALUES ('greatsword_sweep','branch:basic'), ('greatsword_sweep','tier:1'), ('greatsword_sweep','growth.heavy'), ('greatsword_sweep','melee'), ('iai_cut','branch:basic'), ('iai_cut','tier:1'), ('iai_cut','growth.quick'), ('iai_cut','melee'), ('mace_bash','branch:basic'), ('mace_bash','tier:1'), ('mace_bash','growth.heavy'), ('mace_bash','melee'), ('tonfa_strike','branch:basic'), ('tonfa_strike','tier:1'), ('tonfa_strike','growth.quick'), ('tonfa_strike','melee'), ('shield_bash','branch:basic'), ('shield_bash','tier:1'), ('shield_bash','growth.guard'), ('shield_bash','melee'), ('shield_block','branch:basic'), ('shield_block','tier:1'), ('shield_block','growth.guard'), ('spear_thrust','branch:basic'), ('spear_thrust','tier:1'), ('spear_thrust','growth.quick'), ('axe_chop','branch:basic'), ('axe_chop','tier:1'), ('axe_chop','growth.heavy'), ('axe_chop','melee'), ('pick_swing','branch:basic'), ('pick_swing','tier:1'), ('pick_swing','growth.heavy'), ('pick_swing','melee'), ('rod_whip','branch:basic'), ('rod_whip','tier:1'), ('rod_whip','growth.quick')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Each starter needs its weapon in hand (shields: the off hand).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, NULL
FROM (VALUES ('greatsword_sweep','weapon_type','great_sword'), ('iai_cut','weapon_type','katana'), ('mace_bash','weapon_type','mace'), ('tonfa_strike','weapon_type','tonfa'), ('shield_bash','off_hand_type','shield'), ('shield_block','off_hand_type','shield'), ('spear_thrust','weapon_type','spear'), ('axe_chop','weapon_type','axe'), ('pick_swing','weapon_type','pick'), ('rod_whip','weapon_type','rod')) AS x(move_name, kind, value)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value);

-- One tree per weapon.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag FROM (VALUES ('greatsword_sweep','tree:great_sword'), ('iai_cut','tree:katana'), ('mace_bash','tree:mace'), ('tonfa_strike','tree:tonfa'), ('shield_bash','tree:shield'), ('shield_block','tree:shield'), ('spear_thrust','tree:spear'), ('axe_chop','tree:axe'), ('pick_swing','tree:pick'), ('rod_whip','tree:rod')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;
