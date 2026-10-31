-- Effects, requirements, stat exp, interrupts, tags, and unlocks for the starter moves.

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('punch',        1, 'damage',          10, NULL, 1.0,  '{"accuracy":1.0,"hit_count":1}'),
  ('kick',         1, 'damage',          14, NULL, 1.0,  '{"accuracy":0.8,"hit_count":1}'),
  ('heavy_strike', 1, 'damage',          24, NULL, 1.0,  '{"accuracy":0.75,"hit_count":1}'),
  ('heavy_strike', 2, 'stun',             0, 1,    0.2,  '{}'),
  ('pan_bash',     1, 'damage',          12, NULL, 1.0,  '{"accuracy":0.9,"hit_count":1}'),
  ('pan_bash',     2, 'stun',             0, 1,    0.1,  '{}'),
  ('slash',        1, 'damage',          12, NULL, 1.0,  '{"accuracy":0.95,"hit_count":1}'),
  ('slash',        2, 'damage_over_time', 6, 3,    0.25, '{"status":"bleed"}'),
  ('shot',         1, 'damage',          12, NULL, 1.0,  '{"accuracy":0.9,"hit_count":1,"ammo_per_use":1}'),
  ('lucky_shot',   1, 'damage',          10, NULL, 1.0,  '{"accuracy":0.85,"hit_count":1,"crit_bonus":0.25,"ammo_per_use":1}'),
  ('dodge_step',   1, 'buff',             0, 2,    1.0,  '{"stat":"dodgeChance","mult":1.5}'),
  ('guard',        1, 'guard',          0.4, 1,    1.0,  '{}'),
  ('brace',        1, 'guard',          0.3, 2,    1.0,  '{"resist":["knockback","stun"]}'),
  ('bandage',      1, 'channel',          0, 3,    1.0,  '{}'),
  ('bandage',      2, 'heal_over_time',  15, 3,    1.0,  '{"cures":["bleed"]}'),
  ('scavenge',     1, 'scavenge',         0, NULL, 1.0,  '{}'),
  ('taunt',        1, 'taunt',            0, 2,    0.8,  '{}'),
  ('rally',        1, 'buff',             0, 3,    1.0,  '{"stat":"accuracy","mult":1.15}'),
  ('peck',         1, 'damage',           6, NULL, 1.0,  '{"accuracy":1.0,"hit_count":1}'),
  ('wing_flap',    1, 'knockback',        2, NULL, 0.6,  '{}'),
  ('bite',         1, 'damage',           8, NULL, 1.0,  '{"accuracy":0.9,"hit_count":1}'),
  ('tail_whip',    1, 'damage',           9, NULL, 1.0,  '{"accuracy":0.85,"hit_count":1}'),
  ('scratch',      1, 'damage',           6, NULL, 1.0,  '{"accuracy":1.0,"hit_count":2}'),
  ('scratch',      2, 'damage_over_time', 4, 2,    0.15, '{"status":"bleed"}'),
  ('pounce',       1, 'damage',          10, NULL, 1.0,  '{"accuracy":0.8,"hit_count":1}'),
  ('pounce',       2, 'knockback',        0, NULL, 0.3,  '{}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, x.amount
FROM (VALUES
  ('punch',        'body_part',   'hands', NULL::numeric),
  ('kick',         'body_part',   'feet',  NULL),
  ('heavy_strike', 'body_part',   'hands', NULL),
  ('heavy_strike', 'stat_min',    'str',   6),
  ('pan_bash',     'weapon_type', 'pan',   NULL),
  ('slash',        'weapon_type', 'blade', NULL),
  ('shot',         'weapon_type', 'bow',   NULL),
  ('shot',         'ammo_type',   'arrow', NULL),
  ('lucky_shot',   'weapon_type', 'bow',   NULL),
  ('lucky_shot',   'ammo_type',   'arrow', NULL),
  ('dodge_step',   'body_part',   'feet',  NULL),
  ('bandage',      'body_part',   'hands', NULL),
  ('scavenge',     'body_part',   'hands', NULL),
  ('peck',         'body_part',   'beak',  NULL),
  ('wing_flap',    'body_part',   'wings', NULL),
  ('bite',         'body_part',   'teeth', NULL),
  ('tail_whip',    'body_part',   'tail',  NULL),
  ('scratch',      'body_part',   'claws', NULL),
  ('pounce',       'body_part',   'body',  NULL)
) AS x(move_name, kind, value, amount)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('punch', 'str', 3), ('punch', 'dex', 1),
  ('kick', 'dex', 3), ('kick', 'str', 2),
  ('heavy_strike', 'str', 4), ('heavy_strike', 'end', 2),
  ('pan_bash', 'str', 2), ('pan_bash', 'end', 1),
  ('slash', 'dex', 2), ('slash', 'str', 2),
  ('shot', 'dex', 3), ('shot', 'int', 1),
  ('lucky_shot', 'luck', 3), ('lucky_shot', 'dex', 2),
  ('dodge_step', 'dex', 3), ('dodge_step', 'luck', 1),
  ('guard', 'end', 3), ('guard', 'str', 1),
  ('brace', 'end', 4), ('brace', 'str', 1),
  ('bandage', 'int', 2), ('bandage', 'end', 2),
  ('scavenge', 'luck', 3), ('scavenge', 'int', 1),
  ('taunt', 'charm', 3), ('taunt', 'end', 1),
  ('rally', 'charm', 4), ('rally', 'int', 1),
  ('peck', 'dex', 2), ('peck', 'str', 1),
  ('wing_flap', 'dex', 2), ('wing_flap', 'end', 1),
  ('bite', 'str', 2), ('bite', 'dex', 1),
  ('tail_whip', 'str', 2), ('tail_whip', 'end', 1),
  ('scratch', 'dex', 3), ('scratch', 'luck', 1),
  ('pounce', 'dex', 2), ('pounce', 'str', 2)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Interrupt tags. A channel lists what breaks it; other moves list what they give.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES
  ('bandage', 'broken_by', 'damage'),
  ('bandage', 'broken_by', 'stun'),
  ('bandage', 'broken_by', 'knockback'),
  ('heavy_strike', 'gives', 'stun'),
  ('pan_bash', 'gives', 'stun'),
  ('wing_flap', 'gives', 'knockback'),
  ('pounce', 'gives', 'knockback')
) AS x(move_name, role, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Every damaging move gives the damage interrupt tag.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me
JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Tags. Exactly one growth.<tag> per move; the tag must exist in balance_config.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES
  ('punch', 'growth.quick'), ('punch', 'unarmed'), ('punch', 'melee'),
  ('kick', 'growth.heavy'), ('kick', 'unarmed'), ('kick', 'melee'),
  ('heavy_strike', 'growth.heavy'), ('heavy_strike', 'unarmed'), ('heavy_strike', 'melee'),
  ('pan_bash', 'growth.heavy'), ('pan_bash', 'melee'),
  ('slash', 'growth.quick'), ('slash', 'melee'),
  ('shot', 'growth.quick'), ('shot', 'ranged'),
  ('lucky_shot', 'growth.quick'), ('lucky_shot', 'ranged'),
  ('dodge_step', 'growth.quick'),
  ('guard', 'growth.guard'),
  ('brace', 'growth.guard'),
  ('bandage', 'growth.guard'),
  ('scavenge', 'growth.quick'),
  ('taunt', 'growth.guard'),
  ('rally', 'growth.guard'),
  ('peck', 'growth.quick'), ('peck', 'melee'),
  ('wing_flap', 'growth.quick'), ('wing_flap', 'melee'),
  ('bite', 'growth.quick'), ('bite', 'melee'),
  ('tail_whip', 'growth.heavy'), ('tail_whip', 'melee'),
  ('scratch', 'growth.quick'), ('scratch', 'melee'),
  ('pounce', 'growth.heavy'), ('pounce', 'melee')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

-- Unlocks. Same option_group = all must pass. Different groups = any one.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, x.option_group, x.kind, x.params::jsonb
FROM (VALUES
  ('heavy_strike', 'a', 'mastery', '{"move":"punch","level":6}'),
  ('dodge_step',   'a', 'mastery', '{"move":"kick","level":4}'),
  ('guard',        'a', 'trainer', '{"trainer_tag":"guard"}'),
  ('brace',        'a', 'mastery', '{"move":"guard","level":5}'),
  ('bandage',      'a', 'trainer', '{"trainer_tag":"healer"}'),
  ('bandage',      'b', 'scroll',  '{"scroll":"bandage"}'),
  ('lucky_shot',   'a', 'mastery', '{"move":"shot","level":5}'),
  ('scavenge',     'a', 'trainer', '{"trainer_tag":"forager"}'),
  ('taunt',        'a', 'trainer', '{"trainer_tag":"brawler"}'),
  ('rally',        'a', 'combo',   '{"move":"taunt","level":5}'),
  ('rally',        'a', 'combo',   '{"move":"guard","level":5}')
) AS x(move_name, option_group, kind, params)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_unlocks u
  WHERE u.move_id = m.id AND u.option_group = x.option_group AND u.params = x.params::jsonb
);
