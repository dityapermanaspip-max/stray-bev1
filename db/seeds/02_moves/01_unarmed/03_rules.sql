-- Requirements, stat exp, interrupt tags, and tags (growth, tree, branch) for the unarmed leaves.

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('jab','hands'), ('hook','hands'), ('body_shot','hands'), ('cross','hands'), ('overhand','hands'),
  ('palm_strike','hands'), ('soft_palm','hands'), ('spear_hand','hands'),
  ('chain_punch','hands'), ('backfist','hands'), ('gut_punch','hands'), ('eye_jab','hands'),
  ('grab','hands'), ('hip_throw','hands'), ('arm_lock','hands'),
  ('knee_strike','knees'), ('elbow_strike','elbows'), ('clinch','hands'),
  ('low_kick','feet'), ('front_kick','feet'), ('roundhouse','feet'),
  ('nerve_strike','hands'), ('pressure_jab','hands'),
  ('stumble_strike','hands'), ('sway_step','feet'),
  ('ginga','feet'), ('esquiva','feet'), ('meia_lua','feet'), ('rasteira','feet'),
  ('au','feet'), ('au','hands'), ('armada','feet'), ('martelo','feet'),
  ('bananeira','feet'), ('bananeira','hands')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('jab','dex',3), ('jab','str',1), ('hook','str',3), ('hook','dex',1),
  ('body_shot','str',2), ('body_shot','end',2), ('cross','str',3), ('cross','dex',1),
  ('overhand','str',3), ('overhand','end',1),
  ('palm_strike','str',2), ('palm_strike','end',2), ('soft_palm','end',3), ('soft_palm','dex',1),
  ('spear_hand','dex',3), ('spear_hand','str',1),
  ('chain_punch','dex',3), ('chain_punch','str',1), ('backfist','dex',3), ('backfist','luck',1),
  ('gut_punch','str',3), ('gut_punch','end',1), ('eye_jab','dex',2), ('eye_jab','luck',2),
  ('grab','str',2), ('grab','end',2), ('hip_throw','str',3), ('hip_throw','end',1),
  ('arm_lock','str',2), ('arm_lock','end',2),
  ('knee_strike','str',3), ('knee_strike','end',1), ('elbow_strike','str',3), ('elbow_strike','dex',1),
  ('clinch','str',2), ('clinch','end',2),
  ('low_kick','dex',3), ('low_kick','str',1), ('front_kick','str',2), ('front_kick','dex',2),
  ('roundhouse','str',3), ('roundhouse','dex',1),
  ('nerve_strike','int',2), ('nerve_strike','dex',2), ('pressure_jab','int',2), ('pressure_jab','dex',2),
  ('stumble_strike','luck',3), ('stumble_strike','str',1), ('sway_step','luck',3), ('sway_step','dex',1),
  ('ginga','dex',3), ('ginga','end',1), ('esquiva','dex',3), ('esquiva','luck',1),
  ('meia_lua','dex',2), ('meia_lua','str',2), ('rasteira','dex',2), ('rasteira','str',2),
  ('au','dex',3), ('au','end',1), ('armada','str',2), ('armada','dex',1), ('armada','luck',1),
  ('martelo','dex',3), ('martelo','str',1),
  ('bananeira','dex',2), ('bananeira','str',1), ('bananeira','end',1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Binds are held: damage, stun, or a push on the holder breaks them.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES
  ('grab','broken_by','damage'), ('grab','broken_by','stun'), ('grab','broken_by','knockback'),
  ('arm_lock','broken_by','damage'), ('arm_lock','broken_by','stun'), ('arm_lock','broken_by','knockback'),
  ('clinch','broken_by','damage'), ('clinch','broken_by','stun'), ('clinch','broken_by','knockback'),
  ('overhand','gives','stun'), ('hip_throw','gives','stun'), ('rasteira','gives','stun'),
  ('palm_strike','gives','knockback'), ('front_kick','gives','knockback'),
  ('nerve_strike','gives','damage')
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

-- Growth tag, tree and branch for every unarmed move (existing ones included).
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM (VALUES
  ('punch','punch',NULL), ('kick','kick',NULL), ('heavy_strike','brawler',NULL), ('dodge_step','kick',NULL),
  ('jab','boxing','quick'), ('hook','boxing','heavy'), ('body_shot','boxing','quick'),
  ('cross','boxing','heavy'), ('overhand','boxing','heavy'),
  ('palm_strike','palm','quick'), ('soft_palm','palm','guard'), ('spear_hand','palm','heavy'),
  ('chain_punch','karate','quick'), ('backfist','karate','quick'),
  ('gut_punch','brawler','quick'), ('eye_jab','brawler','quick'),
  ('grab','grappling','quick'), ('hip_throw','grappling','heavy'), ('arm_lock','grappling','heavy'),
  ('knee_strike','muay_thai','quick'), ('elbow_strike','muay_thai','quick'), ('clinch','muay_thai','quick'),
  ('low_kick','kick','quick'), ('front_kick','kick','heavy'), ('roundhouse','kick','heavy'),
  ('nerve_strike','pressure_point','quick'), ('pressure_jab','pressure_point','quick'),
  ('stumble_strike','drunken_fist','heavy'), ('sway_step','drunken_fist','quick'),
  ('ginga','capoeira','quick'), ('esquiva','capoeira','guard'), ('meia_lua','capoeira','quick'),
  ('rasteira','capoeira','heavy'), ('au','capoeira','quick'), ('armada','capoeira','heavy'),
  ('martelo','capoeira','quick'), ('bananeira','capoeira','heavy')
) AS x(move_name, branch, growth)
JOIN moves.moves m ON m.move_name = x.move_name
CROSS JOIN LATERAL (VALUES
  ('tree:unarmed'), ('branch:' || x.branch), ('unarmed'), ('melee'), ('growth.' || x.growth)
) AS t(tag)
WHERE t.tag IS NOT NULL
ON CONFLICT (move_id, tag) DO NOTHING;
