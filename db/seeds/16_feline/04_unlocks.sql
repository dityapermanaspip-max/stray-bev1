-- Feline unlocks. Tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13 (Shadow Pounce is a combo).
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('claw_swipe','mastery','scratch',7), ('hook_claw','mastery','scratch',8),
  ('quick_nip','mastery','bite',6), ('scruff_bite','mastery','bite',7),
  ('ambush_leap','mastery','pounce',7), ('slip_away','mastery','crouch',7), ('cat_nap','mastery','crouch',6),
  ('yowl','mastery','hiss',7), ('tail_twitch','mastery','hiss',6),
  ('shred','mastery','hook_claw',10), ('blinding_swipe','mastery','claw_swipe',10),
  ('throat_bite','mastery','scruff_bite',10), ('pin_down','mastery','ambush_leap',10),
  ('land_on_feet','mastery','slip_away',10), ('glare','mastery','tail_twitch',10), ('caterwaul','mastery','yowl',10),
  ('ribbon_slash','mastery','shred',13), ('death_grip','mastery','throat_bite',13),
  -- combo: both rows in group a must pass
  ('shadow_pounce','combo','pin_down',13), ('shadow_pounce','combo','slip_away',10)
) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent
);
