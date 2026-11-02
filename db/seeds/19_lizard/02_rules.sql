-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('scurry','feet'), ('claw_rake','claws'), ('bask','scales'), ('snap_bite','teeth'), ('lockjaw','teeth'), ('tail_sweep','tail'), ('tail_drop','tail'), ('tear','claws'), ('harden_scales','scales'), ('frill_flare','voice'), ('death_roll','teeth'), ('death_roll','tail'), ('crushing_jaws','teeth'), ('club_tail','tail'), ('gut_rake','claws'), ('stone_scales','scales'), ('primal_bite','teeth'), ('thrash','teeth'), ('thrash','tail')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('scurry','dex',3), ('scurry','luck',1), ('claw_rake','dex',3), ('claw_rake','str',1), ('bask','end',3), ('bask','luck',1), ('snap_bite','dex',3), ('snap_bite','str',1), ('lockjaw','str',3), ('lockjaw','end',1), ('tail_sweep','str',2), ('tail_sweep','dex',2), ('tail_drop','dex',2), ('tail_drop','luck',2), ('tear','dex',2), ('tear','str',2), ('harden_scales','end',4), ('frill_flare','charm',3), ('frill_flare','int',1), ('death_roll','str',3), ('death_roll','end',1), ('crushing_jaws','str',3), ('crushing_jaws','luck',1), ('club_tail','str',3), ('club_tail','end',1), ('gut_rake','dex',3), ('gut_rake','str',1), ('stone_scales','end',4), ('primal_bite','str',3), ('primal_bite','luck',1), ('thrash','str',2), ('thrash','end',2)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('tail_sweep','gives','knockback'), ('crushing_jaws','gives','stun'), ('club_tail','gives','knockback'), ('thrash','gives','knockback'), ('lockjaw','broken_by','damage'), ('lockjaw','broken_by','stun'), ('lockjaw','broken_by','knockback'), ('death_roll','broken_by','damage'), ('death_roll','broken_by','stun'), ('death_roll','broken_by','knockback')) AS x(move_name, role, tag)
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
FROM (VALUES ('scurry','tree:reptile'), ('scurry','branch:scales'), ('scurry','tier:1'), ('scurry','growth.guard'), ('claw_rake','tree:reptile'), ('claw_rake','branch:claws'), ('claw_rake','tier:1'), ('claw_rake','growth.quick'), ('claw_rake','melee'), ('bask','tree:reptile'), ('bask','branch:scales'), ('bask','tier:1'), ('bask','growth.guard'), ('snap_bite','tree:reptile'), ('snap_bite','branch:jaws'), ('snap_bite','tier:2'), ('snap_bite','growth.quick'), ('snap_bite','melee'), ('lockjaw','tree:reptile'), ('lockjaw','branch:jaws'), ('lockjaw','tier:2'), ('lockjaw','growth.heavy'), ('lockjaw','melee'), ('tail_sweep','tree:reptile'), ('tail_sweep','branch:tail'), ('tail_sweep','tier:2'), ('tail_sweep','growth.heavy'), ('tail_sweep','melee'), ('tail_drop','tree:reptile'), ('tail_drop','branch:tail'), ('tail_drop','tier:2'), ('tail_drop','growth.guard'), ('tear','tree:reptile'), ('tear','branch:claws'), ('tear','tier:2'), ('tear','growth.quick'), ('tear','melee'), ('harden_scales','tree:reptile'), ('harden_scales','branch:scales'), ('harden_scales','tier:2'), ('harden_scales','growth.guard'), ('frill_flare','tree:reptile'), ('frill_flare','branch:voice'), ('frill_flare','tier:2'), ('frill_flare','growth.quick'), ('death_roll','tree:reptile'), ('death_roll','branch:jaws'), ('death_roll','tier:3'), ('death_roll','growth.heavy'), ('death_roll','melee'), ('crushing_jaws','tree:reptile'), ('crushing_jaws','branch:jaws'), ('crushing_jaws','tier:3'), ('crushing_jaws','growth.heavy'), ('crushing_jaws','melee'), ('club_tail','tree:reptile'), ('club_tail','branch:tail'), ('club_tail','tier:3'), ('club_tail','growth.heavy'), ('club_tail','melee'), ('gut_rake','tree:reptile'), ('gut_rake','branch:claws'), ('gut_rake','tier:3'), ('gut_rake','growth.quick'), ('gut_rake','melee'), ('stone_scales','tree:reptile'), ('stone_scales','branch:scales'), ('stone_scales','tier:3'), ('stone_scales','growth.guard'), ('primal_bite','tree:reptile'), ('primal_bite','branch:jaws'), ('primal_bite','tier:4'), ('primal_bite','growth.heavy'), ('primal_bite','melee'), ('thrash','tree:reptile'), ('thrash','branch:tail'), ('thrash','tier:4'), ('thrash','growth.heavy'), ('thrash','melee'), ('bite','tree:reptile'), ('bite','branch:jaws'), ('bite','tier:1'), ('tail_whip','tree:reptile'), ('tail_whip','branch:tail'), ('tail_whip','tier:1'), ('hiss','tree:reptile'), ('hiss','branch:voice'), ('hiss','tier:1')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; combo rows in group a must all pass.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES ('snap_bite','mastery','bite',7), ('lockjaw','mastery','bite',8), ('tail_sweep','mastery','tail_whip',7), ('tail_drop','mastery','tail_whip',6), ('tear','mastery','claw_rake',7), ('harden_scales','mastery','bask',7), ('frill_flare','mastery','hiss',7), ('death_roll','mastery','lockjaw',10), ('crushing_jaws','mastery','snap_bite',10), ('club_tail','mastery','tail_sweep',10), ('gut_rake','mastery','tear',10), ('stone_scales','mastery','harden_scales',10), ('primal_bite','mastery','crushing_jaws',13), ('thrash','combo','death_roll',13), ('thrash','combo','club_tail',10)) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent);
