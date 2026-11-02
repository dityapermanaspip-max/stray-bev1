-- Body parts, stat exp, interrupt tags, tags and unlocks (generated from the move spec).
INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES ('rot_peck','beak'), ('dread_squawk','voice'), ('blight_spur','spurs'), ('mad_dash','feet'), ('brimstone_breath','beak'), ('brimstone_breath','embers'), ('plague_claws','claws'), ('night_terror','voice'), ('hollow_bite','teeth'), ('rotting_horns','horns'), ('black_stampede','body'), ('black_stampede','feet'), ('mad_bellow','voice'), ('venom_bite','teeth'), ('bile_spit','teeth'), ('cold_blood','scales'), ('rabid_bite','teeth'), ('blood_frenzy','body'), ('carrion_roar','voice')) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES ('rot_peck','dex',2), ('rot_peck','int',2), ('dread_squawk','charm',3), ('dread_squawk','int',1), ('blight_spur','str',2), ('blight_spur','int',2), ('mad_dash','dex',3), ('mad_dash','luck',1), ('brimstone_breath','int',3), ('brimstone_breath','end',1), ('plague_claws','dex',2), ('plague_claws','int',2), ('night_terror','int',2), ('night_terror','charm',2), ('hollow_bite','str',2), ('hollow_bite','int',2), ('rotting_horns','str',2), ('rotting_horns','int',2), ('black_stampede','str',2), ('black_stampede','end',2), ('mad_bellow','charm',2), ('mad_bellow','str',2), ('venom_bite','str',2), ('venom_bite','int',2), ('bile_spit','int',3), ('bile_spit','dex',1), ('cold_blood','end',2), ('cold_blood','luck',2), ('rabid_bite','str',2), ('rabid_bite','int',2), ('blood_frenzy','str',2), ('blood_frenzy','end',2), ('carrion_roar','charm',3), ('carrion_roar','end',1)) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Holds are broken by damage, stun or a push on the holder.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES ('night_terror','gives','stun'), ('black_stampede','gives','knockback')) AS x(move_name, role, tag)
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
FROM (VALUES ('rot_peck','tree:fowl'), ('rot_peck','branch:corruption'), ('rot_peck','tier:2'), ('rot_peck','growth.quick'), ('rot_peck','melee'), ('rot_peck','corrupted'), ('dread_squawk','tree:fowl'), ('dread_squawk','branch:corruption'), ('dread_squawk','tier:2'), ('dread_squawk','growth.quick'), ('dread_squawk','corrupted'), ('blight_spur','tree:fowl'), ('blight_spur','branch:corruption'), ('blight_spur','tier:3'), ('blight_spur','growth.heavy'), ('blight_spur','melee'), ('blight_spur','corrupted'), ('mad_dash','tree:fowl'), ('mad_dash','branch:corruption'), ('mad_dash','tier:2'), ('mad_dash','growth.quick'), ('mad_dash','corrupted'), ('brimstone_breath','tree:fowl'), ('brimstone_breath','branch:corruption'), ('brimstone_breath','tier:3'), ('brimstone_breath','growth.heavy'), ('brimstone_breath','corrupted'), ('brimstone_breath','fire'), ('plague_claws','tree:feline'), ('plague_claws','branch:corruption'), ('plague_claws','tier:2'), ('plague_claws','growth.quick'), ('plague_claws','melee'), ('plague_claws','corrupted'), ('night_terror','tree:feline'), ('night_terror','branch:corruption'), ('night_terror','tier:3'), ('night_terror','growth.quick'), ('night_terror','corrupted'), ('hollow_bite','tree:feline'), ('hollow_bite','branch:corruption'), ('hollow_bite','tier:2'), ('hollow_bite','growth.quick'), ('hollow_bite','melee'), ('hollow_bite','corrupted'), ('rotting_horns','tree:bovine'), ('rotting_horns','branch:corruption'), ('rotting_horns','tier:2'), ('rotting_horns','growth.heavy'), ('rotting_horns','melee'), ('rotting_horns','corrupted'), ('black_stampede','tree:bovine'), ('black_stampede','branch:corruption'), ('black_stampede','tier:3'), ('black_stampede','growth.heavy'), ('black_stampede','corrupted'), ('mad_bellow','tree:bovine'), ('mad_bellow','branch:corruption'), ('mad_bellow','tier:2'), ('mad_bellow','growth.quick'), ('mad_bellow','corrupted'), ('venom_bite','tree:reptile'), ('venom_bite','branch:corruption'), ('venom_bite','tier:2'), ('venom_bite','growth.quick'), ('venom_bite','melee'), ('venom_bite','corrupted'), ('bile_spit','tree:reptile'), ('bile_spit','branch:corruption'), ('bile_spit','tier:2'), ('bile_spit','growth.quick'), ('bile_spit','corrupted'), ('cold_blood','tree:reptile'), ('cold_blood','branch:corruption'), ('cold_blood','tier:2'), ('cold_blood','growth.guard'), ('cold_blood','corrupted'), ('rabid_bite','tree:ursine'), ('rabid_bite','branch:corruption'), ('rabid_bite','tier:2'), ('rabid_bite','growth.heavy'), ('rabid_bite','melee'), ('rabid_bite','corrupted'), ('blood_frenzy','tree:ursine'), ('blood_frenzy','branch:corruption'), ('blood_frenzy','tier:3'), ('blood_frenzy','growth.quick'), ('blood_frenzy','corrupted'), ('carrion_roar','tree:ursine'), ('carrion_roar','branch:corruption'), ('carrion_roar','tier:3'), ('carrion_roar','growth.quick'), ('carrion_roar','corrupted')) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;
