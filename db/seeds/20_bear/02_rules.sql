-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('roar','voice'), ('rear_up','body'), ('swat','claws'), ('rend','claws'), ('crunch','teeth'), ('chomp','teeth'), ('bear_hug','body'), ('bear_hug','claws'), ('thick_fur','body'), ('terrifying_roar','voice'), ('savage_maul','claws'), ('bone_crusher','teeth'), ('crushing_hug','body'), ('crushing_hug','claws'), ('ground_slam','claws'), ('ground_slam','body'), ('lick_wounds','teeth'), ('berserk_frenzy','claws'), ('unstoppable','body')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('roar','charm',2), ('roar','end',2), ('rear_up','str',2), ('rear_up','end',2), ('swat','str',3), ('swat','end',1), ('rend','str',2), ('rend','dex',2), ('crunch','str',3), ('crunch','end',1), ('chomp','str',2), ('chomp','dex',2), ('bear_hug','str',3), ('bear_hug','end',1), ('thick_fur','end',4), ('terrifying_roar','charm',3), ('terrifying_roar','end',1), ('savage_maul','str',3), ('savage_maul','dex',1), ('bone_crusher','str',3), ('bone_crusher','end',1), ('crushing_hug','str',3), ('crushing_hug','end',1), ('ground_slam','str',3), ('ground_slam','end',1), ('lick_wounds','end',3), ('lick_wounds','luck',1), ('berserk_frenzy','str',3), ('berserk_frenzy','end',1), ('unstoppable','str',2), ('unstoppable','end',2)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('swat','gives','knockback'), ('bone_crusher','gives','stun'), ('ground_slam','gives','stun'), ('unstoppable','gives','knockback'), ('unstoppable','gives','stun'), ('bear_hug','broken_by','damage'), ('bear_hug','broken_by','stun'), ('bear_hug','broken_by','knockback'), ('crushing_hug','broken_by','damage'), ('crushing_hug','broken_by','stun'), ('crushing_hug','broken_by','knockback')) AS x(move_name, role, tag)
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
FROM (VALUES ('roar','tree:ursine'), ('roar','branch:voice'), ('roar','tier:1'), ('roar','growth.quick'), ('rear_up','tree:ursine'), ('rear_up','branch:bulk'), ('rear_up','tier:1'), ('rear_up','growth.quick'), ('swat','tree:ursine'), ('swat','branch:paws'), ('swat','tier:2'), ('swat','growth.heavy'), ('swat','melee'), ('rend','tree:ursine'), ('rend','branch:paws'), ('rend','tier:2'), ('rend','growth.quick'), ('rend','melee'), ('crunch','tree:ursine'), ('crunch','branch:jaws'), ('crunch','tier:2'), ('crunch','growth.heavy'), ('crunch','melee'), ('chomp','tree:ursine'), ('chomp','branch:jaws'), ('chomp','tier:2'), ('chomp','growth.quick'), ('chomp','melee'), ('bear_hug','tree:ursine'), ('bear_hug','branch:bulk'), ('bear_hug','tier:2'), ('bear_hug','growth.heavy'), ('bear_hug','melee'), ('thick_fur','tree:ursine'), ('thick_fur','branch:bulk'), ('thick_fur','tier:2'), ('thick_fur','growth.guard'), ('terrifying_roar','tree:ursine'), ('terrifying_roar','branch:voice'), ('terrifying_roar','tier:2'), ('terrifying_roar','growth.quick'), ('savage_maul','tree:ursine'), ('savage_maul','branch:paws'), ('savage_maul','tier:3'), ('savage_maul','growth.heavy'), ('savage_maul','melee'), ('bone_crusher','tree:ursine'), ('bone_crusher','branch:jaws'), ('bone_crusher','tier:3'), ('bone_crusher','growth.heavy'), ('bone_crusher','melee'), ('crushing_hug','tree:ursine'), ('crushing_hug','branch:bulk'), ('crushing_hug','tier:3'), ('crushing_hug','growth.heavy'), ('crushing_hug','melee'), ('ground_slam','tree:ursine'), ('ground_slam','branch:paws'), ('ground_slam','tier:3'), ('ground_slam','growth.heavy'), ('ground_slam','melee'), ('lick_wounds','tree:ursine'), ('lick_wounds','branch:bulk'), ('lick_wounds','tier:3'), ('lick_wounds','growth.guard'), ('berserk_frenzy','tree:ursine'), ('berserk_frenzy','branch:paws'), ('berserk_frenzy','tier:4'), ('berserk_frenzy','growth.heavy'), ('berserk_frenzy','melee'), ('unstoppable','tree:ursine'), ('unstoppable','branch:bulk'), ('unstoppable','tier:4'), ('unstoppable','growth.heavy'), ('maul','tree:ursine'), ('maul','branch:paws'), ('maul','tier:1'), ('bite','tree:ursine'), ('bite','branch:jaws'), ('bite','tier:1'), ('scratch','tree:ursine'), ('scratch','branch:paws'), ('scratch','tier:1')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('swat','mastery','maul',7), ('rend','mastery','maul',8), ('crunch','mastery','bite',7), ('chomp','mastery','bite',8), ('bear_hug','mastery','rear_up',7), ('thick_fur','mastery','rear_up',6), ('terrifying_roar','mastery','roar',7), ('savage_maul','mastery','rend',10), ('bone_crusher','mastery','crunch',10), ('crushing_hug','mastery','bear_hug',10), ('ground_slam','mastery','swat',10), ('lick_wounds','mastery','thick_fur',10), ('berserk_frenzy','mastery','savage_maul',13), ('unstoppable','combo','ground_slam',13), ('unstoppable','combo','thick_fur',10)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);
