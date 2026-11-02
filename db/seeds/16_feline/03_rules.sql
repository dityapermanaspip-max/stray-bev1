-- Body parts, stat exp, interrupt tags and tags for the feline tree (scratch, bite and pounce join it).

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('crouch','feet'), ('hiss','voice'),
  ('claw_swipe','claws'), ('hook_claw','claws'), ('quick_nip','teeth'), ('scruff_bite','teeth'),
  ('ambush_leap','body'), ('ambush_leap','feet'), ('slip_away','feet'), ('slip_away','claws'), ('cat_nap','body'),
  ('yowl','voice'), ('tail_twitch','tail'),
  ('shred','claws'), ('blinding_swipe','claws'), ('throat_bite','teeth'), ('pin_down','body'), ('pin_down','claws'),
  ('land_on_feet','feet'), ('caterwaul','voice'),
  ('ribbon_slash','claws'), ('death_grip','teeth'), ('shadow_pounce','body'), ('shadow_pounce','claws')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part
);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('crouch','dex',3), ('crouch','luck',1), ('hiss','charm',3), ('hiss','int',1),
  ('claw_swipe','dex',3), ('claw_swipe','str',1), ('hook_claw','dex',3), ('hook_claw','luck',1),
  ('quick_nip','dex',3), ('quick_nip','str',1), ('scruff_bite','str',3), ('scruff_bite','end',1),
  ('ambush_leap','dex',2), ('ambush_leap','luck',2), ('slip_away','dex',3), ('slip_away','luck',1),
  ('cat_nap','end',3), ('cat_nap','luck',1), ('yowl','charm',3), ('yowl','end',1),
  ('tail_twitch','int',2), ('tail_twitch','dex',2),
  ('shred','dex',3), ('shred','str',1), ('blinding_swipe','dex',2), ('blinding_swipe','luck',2),
  ('throat_bite','str',2), ('throat_bite','luck',2), ('pin_down','str',3), ('pin_down','end',1),
  ('land_on_feet','dex',2), ('land_on_feet','end',2), ('glare','int',2), ('glare','charm',2),
  ('caterwaul','charm',3), ('caterwaul','end',1),
  ('ribbon_slash','dex',3), ('ribbon_slash','luck',1), ('death_grip','str',3), ('death_grip','end',1),
  ('shadow_pounce','dex',2), ('shadow_pounce','luck',1), ('shadow_pounce','str',1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

-- Binds are held: damage, stun or a push on the holder breaks them.
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, x.role, x.tag
FROM (VALUES
  ('scruff_bite','broken_by','damage'), ('scruff_bite','broken_by','stun'), ('scruff_bite','broken_by','knockback'),
  ('pin_down','broken_by','damage'), ('pin_down','broken_by','stun'), ('pin_down','broken_by','knockback'),
  ('death_grip','broken_by','damage'), ('death_grip','broken_by','stun'), ('death_grip','broken_by','knockback'),
  ('glare','gives','stun'), ('shadow_pounce','gives','stun')
) AS x(move_name, role, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Every damaging move gives the damage interrupt tag (same rule as the unarmed seed, run again for these moves).
INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT DISTINCT me.move_id, 'gives', 'damage'
FROM moves.move_effects me
JOIN moves.effect_types e ON e.id = me.effect_type_id
WHERE e.handler_key IN ('damage', 'damage_over_time') AND me.power > 0
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Tree, branch, tier and growth tags. scratch, bite and pounce already carry their growth tag.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM (VALUES
  ('scratch','claws',1,NULL), ('bite','teeth',1,NULL), ('pounce','prowl',1,NULL),
  ('crouch','prowl',1,'guard'), ('hiss','voice',1,'quick'),
  ('claw_swipe','claws',2,'quick'), ('hook_claw','claws',2,'quick'), ('quick_nip','teeth',2,'quick'),
  ('scruff_bite','teeth',2,'heavy'), ('ambush_leap','prowl',2,'heavy'), ('slip_away','prowl',2,'guard'),
  ('cat_nap','prowl',2,'guard'), ('yowl','voice',2,'quick'), ('tail_twitch','voice',2,'quick'),
  ('shred','claws',3,'quick'), ('blinding_swipe','claws',3,'quick'), ('throat_bite','teeth',3,'heavy'),
  ('pin_down','prowl',3,'heavy'), ('land_on_feet','prowl',3,'guard'), ('glare','voice',3,'quick'),
  ('caterwaul','voice',3,'quick'),
  ('ribbon_slash','claws',4,'quick'), ('death_grip','teeth',4,'heavy'), ('shadow_pounce','prowl',4,'heavy')
) AS x(move_name, branch, tier, growth)
JOIN moves.moves m ON m.move_name = x.move_name
CROSS JOIN LATERAL (VALUES
  ('tree:feline'), ('branch:' || x.branch), ('tier:' || x.tier), ('growth.' || x.growth),
  (CASE WHEN m.row_rule = 'front' THEN 'melee' END)
) AS t(tag)
WHERE t.tag IS NOT NULL
ON CONFLICT (move_id, tag) DO NOTHING;
