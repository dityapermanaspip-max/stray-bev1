-- Unlock rows decide what unlocks; tree and branch tags only group. Leaf <- parent move level.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', 'mastery', jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('jab','punch',5), ('hook','punch',7), ('body_shot','jab',6), ('cross','jab',8), ('overhand','hook',10),
  ('palm_strike','punch',3), ('soft_palm','palm_strike',8), ('spear_hand','palm_strike',10),
  ('chain_punch','punch',8), ('backfist','punch',9),
  ('gut_punch','punch',3), ('eye_jab','punch',9),
  ('grab','punch',4), ('hip_throw','grab',7), ('arm_lock','grab',10),
  ('knee_strike','kick',4), ('elbow_strike','punch',6), ('clinch','knee_strike',9),
  ('low_kick','kick',3), ('front_kick','kick',6), ('roundhouse','kick',9),
  ('nerve_strike','palm_strike',5), ('pressure_jab','palm_strike',9),
  ('stumble_strike','punch',5), ('sway_step','stumble_strike',9),
  ('ginga','kick',3), ('esquiva','ginga',4), ('meia_lua','kick',5), ('rasteira','ginga',6),
  ('au','esquiva',7), ('armada','ginga',8), ('martelo','kick',9), ('bananeira','au',10)
) AS x(move_name, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a');
