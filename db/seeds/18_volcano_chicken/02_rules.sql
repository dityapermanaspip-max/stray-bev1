-- Body parts, stat exp, interrupt tags, tags and unlocks for the cinder branch.

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('ember_peck','beak'), ('ember_peck','embers'), ('spark_flap','wings'), ('spark_flap','embers'),
  ('rekindle','embers'), ('fire_spit','beak'), ('fire_spit','embers'), ('ash_cloud','wings'), ('ash_cloud','embers'),
  ('molten_feathers','embers'), ('flame_breath','beak'), ('flame_breath','embers'),
  ('cinder_storm','wings'), ('cinder_storm','embers'),
  ('phoenix_dive','wings'), ('phoenix_dive','feet'), ('phoenix_dive','embers')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('ember_peck','dex',2), ('ember_peck','int',2), ('spark_flap','int',3), ('spark_flap','dex',1),
  ('rekindle','end',3), ('rekindle','int',1), ('fire_spit','int',3), ('fire_spit','dex',1),
  ('ash_cloud','int',2), ('ash_cloud','dex',2), ('molten_feathers','end',3), ('molten_feathers','int',1),
  ('flame_breath','int',3), ('flame_breath','end',1), ('cinder_storm','int',3), ('cinder_storm','luck',1),
  ('phoenix_dive','int',2), ('phoenix_dive','str',1), ('phoenix_dive','dex',1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', 'knockback' FROM moves.moves m WHERE m.move_name = 'phoenix_dive'
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Every damaging move gives the damage interrupt tag (same rule as the unarmed seed, run again for these moves).
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me
JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM (VALUES
  ('ember_peck',1,'quick'), ('spark_flap',1,'quick'),
  ('rekindle',2,'guard'), ('fire_spit',2,'quick'), ('ash_cloud',2,'quick'), ('molten_feathers',2,'guard'),
  ('flame_breath',3,'heavy'), ('cinder_storm',3,'heavy'), ('phoenix_dive',4,'heavy')
) AS x(move_name, tier, growth)
JOIN moves.moves m ON m.move_name = x.move_name
CROSS JOIN LATERAL (VALUES
  ('tree:fowl'), ('branch:cinder'), ('fire'), ('tier:' || x.tier), ('growth.' || x.growth),
  (CASE WHEN m.row_rule = 'front' THEN 'melee' END)
) AS t(tag)
WHERE t.tag IS NOT NULL
ON CONFLICT (move_id, tag) DO NOTHING;

-- Tier 2 at the parent's lv6-8, tier 3 at lv10, Phoenix Dive is a combo at lv13 + lv10.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('rekindle','mastery','ember_peck',6), ('fire_spit','mastery','ember_peck',7),
  ('ash_cloud','mastery','spark_flap',7), ('molten_feathers','mastery','spark_flap',8),
  ('flame_breath','mastery','fire_spit',10), ('cinder_storm','mastery','ash_cloud',10),
  ('phoenix_dive','combo','flame_breath',13), ('phoenix_dive','combo','molten_feathers',10)
) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent
);
