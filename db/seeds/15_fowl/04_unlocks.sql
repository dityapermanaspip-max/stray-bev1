-- Fowl unlocks. Tier 2 opens at the parent's practiced levels (6-8), tier 3 at 10, tier 4 at 13 (skilled).
-- A rolled creature only gets a move once its rule passes on the levels rolled so far (world/creature_roll.ts);
-- tamed beasts later grow into them the same way as players.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('triple_peck','mastery','peck',7), ('eye_peck','mastery','peck',8), ('grain_snack','mastery','peck',6),
  ('wing_buffet','mastery','wing_flap',7), ('dust_bath','mastery','wing_flap',8), ('flutter_back','mastery','flutter',7),
  ('talon_rake','mastery','claw_kick',7), ('hop_kick','mastery','claw_kick',8),
  ('puff_up','mastery','squawk',6), ('alarm_cry','mastery','squawk',7),
  ('peck_flurry','mastery','triple_peck',10), ('skull_peck','mastery','eye_peck',10),
  ('gale_wings','mastery','wing_buffet',10), ('feather_storm','mastery','dust_bath',10),
  ('spur_strike','mastery','talon_rake',10), ('flying_kick','mastery','hop_kick',10), ('dawn_crow','mastery','alarm_cry',10),
  ('peck_storm','mastery','peck_flurry',13), ('spur_fury','mastery','spur_strike',13),
  -- combo: both rows in group a must pass
  ('roosters_challenge','combo','dawn_crow',13), ('roosters_challenge','combo','spur_strike',10)
) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent
);
