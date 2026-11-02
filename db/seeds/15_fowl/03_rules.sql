-- Body parts, stat exp, interrupt tags and tags for the fowl tree (peck and wing_flap join it).

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('flutter','wings'), ('claw_kick','feet'), ('squawk','voice'),
  ('triple_peck','beak'), ('eye_peck','beak'), ('grain_snack','beak'),
  ('wing_buffet','wings'), ('dust_bath','wings'), ('dust_bath','feet'), ('flutter_back','wings'), ('flutter_back','beak'),
  ('talon_rake','feet'), ('hop_kick','feet'), ('puff_up','wings'), ('alarm_cry','voice'),
  ('peck_flurry','beak'), ('skull_peck','beak'), ('gale_wings','wings'), ('feather_storm','wings'),
  ('spur_strike','spurs'), ('flying_kick','feet'), ('flying_kick','wings'), ('dawn_crow','voice'),
  ('peck_storm','beak'), ('spur_fury','spurs'), ('roosters_challenge','voice'), ('roosters_challenge','spurs')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('flutter','dex',3), ('flutter','luck',1), ('claw_kick','dex',2), ('claw_kick','str',2),
  ('squawk','charm',3), ('squawk','end',1),
  ('triple_peck','dex',3), ('triple_peck','str',1), ('eye_peck','dex',2), ('eye_peck','luck',2),
  ('grain_snack','end',3), ('grain_snack','luck',1),
  ('wing_buffet','str',2), ('wing_buffet','end',2), ('dust_bath','dex',2), ('dust_bath','int',2),
  ('flutter_back','dex',3), ('flutter_back','luck',1), ('talon_rake','dex',3), ('talon_rake','str',1),
  ('hop_kick','dex',2), ('hop_kick','str',2), ('puff_up','end',3), ('puff_up','charm',1),
  ('alarm_cry','charm',3), ('alarm_cry','int',1),
  ('peck_flurry','dex',3), ('peck_flurry','str',1), ('skull_peck','str',3), ('skull_peck','dex',1),
  ('gale_wings','str',2), ('gale_wings','end',2), ('feather_storm','dex',2), ('feather_storm','int',2),
  ('spur_strike','str',2), ('spur_strike','dex',1), ('spur_strike','luck',1),
  ('flying_kick','str',3), ('flying_kick','dex',1), ('dawn_crow','charm',3), ('dawn_crow','end',1),
  ('peck_storm','dex',3), ('peck_storm','end',1), ('spur_fury','str',2), ('spur_fury','dex',2),
  ('roosters_challenge','charm',2), ('roosters_challenge','str',2)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', x.tag
FROM (VALUES
  ('wing_buffet','knockback'), ('gale_wings','knockback'), ('flying_kick','knockback'), ('skull_peck','stun')
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

-- Tree, branch, tier and growth tags. peck and wing_flap already carry growth.quick and melee.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM (VALUES
  ('peck','beak',1,NULL), ('wing_flap','wings',1,NULL),
  ('flutter','wings',1,'guard'), ('claw_kick','feet',1,'quick'), ('squawk','voice',1,'quick'),
  ('triple_peck','beak',2,'quick'), ('eye_peck','beak',2,'quick'), ('grain_snack','beak',2,'guard'),
  ('wing_buffet','wings',2,'heavy'), ('dust_bath','wings',2,'quick'), ('flutter_back','wings',2,'guard'),
  ('talon_rake','feet',2,'quick'), ('hop_kick','feet',2,'quick'), ('puff_up','voice',2,'guard'), ('alarm_cry','voice',2,'quick'),
  ('peck_flurry','beak',3,'quick'), ('skull_peck','beak',3,'heavy'), ('gale_wings','wings',3,'heavy'),
  ('feather_storm','wings',3,'heavy'), ('spur_strike','feet',3,'heavy'), ('flying_kick','feet',3,'heavy'),
  ('dawn_crow','voice',3,'quick'),
  ('peck_storm','beak',4,'heavy'), ('spur_fury','feet',4,'heavy'), ('roosters_challenge','voice',4,'quick')
) AS x(move_name, branch, tier, growth)
JOIN moves.moves m ON m.move_name = x.move_name
CROSS JOIN LATERAL (VALUES
  ('tree:fowl'), ('branch:' || x.branch), ('tier:' || x.tier), ('growth.' || x.growth),
  (CASE WHEN m.row_rule = 'front' THEN 'melee' END)
) AS t(tag)
WHERE t.tag IS NOT NULL
ON CONFLICT (move_id, tag) DO NOTHING;
