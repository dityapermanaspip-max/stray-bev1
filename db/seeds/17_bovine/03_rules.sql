-- Body parts, stat exp, interrupt tags and tags for the bovine tree (charge and gore join it; kick stays unarmed).

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('bellow','voice'), ('paw_ground','feet'),
  ('horn_toss','horns'), ('hook_horn','horns'), ('shoulder_ram','body'), ('thick_hide','body'),
  ('stomp','feet'), ('back_kick','feet'), ('tail_swish','tail'), ('snort','voice'), ('rage','body'),
  ('impale','horns'), ('sweep_horns','horns'), ('stampede','body'), ('stampede','feet'), ('trample','feet'),
  ('ground_pound','feet'), ('seeing_red','body'), ('war_bellow','voice'),
  ('skewer','horns'), ('juggernaut','body'), ('juggernaut','horns')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('bellow','charm',2), ('bellow','end',2), ('paw_ground','end',2), ('paw_ground','luck',2),
  ('horn_toss','str',3), ('horn_toss','end',1), ('hook_horn','str',2), ('hook_horn','dex',2),
  ('shoulder_ram','str',2), ('shoulder_ram','end',2), ('thick_hide','end',4),
  ('stomp','str',3), ('stomp','end',1), ('back_kick','str',3), ('back_kick','dex',1),
  ('tail_swish','dex',3), ('tail_swish','luck',1), ('snort','charm',3), ('snort','end',1),
  ('rage','str',2), ('rage','end',2),
  ('impale','str',3), ('impale','luck',1), ('sweep_horns','str',3), ('sweep_horns','end',1),
  ('stampede','str',2), ('stampede','end',2), ('trample','str',3), ('trample','end',1),
  ('ground_pound','str',3), ('ground_pound','end',1), ('seeing_red','str',2), ('seeing_red','luck',2),
  ('war_bellow','charm',3), ('war_bellow','end',1),
  ('skewer','str',3), ('skewer','luck',1), ('juggernaut','str',2), ('juggernaut','end',2)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', x.tag
FROM (VALUES
  ('horn_toss','knockback'), ('back_kick','knockback'), ('sweep_horns','knockback'), ('stampede','knockback'),
  ('juggernaut','knockback'), ('shoulder_ram','stun'), ('ground_pound','stun'), ('skewer','stun'), ('juggernaut','stun')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Every damaging move gives the damage interrupt tag (same rule as the unarmed seed, run again for these moves).
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me
JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Tree, branch, tier and growth tags. charge and gore already carry their growth tag.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM (VALUES
  ('charge','bulk',1,NULL), ('gore','horns',1,NULL),
  ('bellow','temper',1,'quick'), ('paw_ground','hooves',1,'quick'),
  ('horn_toss','horns',2,'heavy'), ('hook_horn','horns',2,'quick'), ('shoulder_ram','bulk',2,'heavy'),
  ('thick_hide','bulk',2,'guard'), ('stomp','hooves',2,'heavy'), ('back_kick','hooves',2,'heavy'),
  ('tail_swish','temper',2,'quick'), ('snort','temper',2,'quick'), ('rage','temper',2,'quick'),
  ('impale','horns',3,'heavy'), ('sweep_horns','horns',3,'heavy'), ('stampede','bulk',3,'heavy'),
  ('trample','hooves',3,'heavy'), ('ground_pound','hooves',3,'heavy'), ('seeing_red','temper',3,'quick'),
  ('war_bellow','temper',3,'quick'),
  ('skewer','horns',4,'heavy'), ('juggernaut','bulk',4,'heavy')
) AS x(move_name, branch, tier, growth)
JOIN moves.moves m ON m.move_name = x.move_name
CROSS JOIN LATERAL (VALUES
  ('tree:bovine'), ('branch:' || x.branch), ('tier:' || x.tier), ('growth.' || x.growth),
  (CASE WHEN m.row_rule = 'front' THEN 'melee' END)
) AS t(tag)
WHERE t.tag IS NOT NULL
ON CONFLICT (move_id, tag) DO NOTHING;
