-- Display names. One row per move; the startup check requires it.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('punch', 'Punch'),
  ('kick', 'Kick'),
  ('heavy_strike', 'Heavy Strike'),
  ('pan_bash', 'Pan Bash'),
  ('slash', 'Slash'),
  ('shot', 'Shot'),
  ('lucky_shot', 'Lucky Shot'),
  ('dodge_step', 'Dodge Step'),
  ('guard', 'Guard'),
  ('brace', 'Brace'),
  ('bandage', 'Bandage'),
  ('scavenge', 'Scavenge'),
  ('taunt', 'Taunt'),
  ('rally', 'Rally'),
  ('peck', 'Peck'),
  ('wing_flap', 'Wing Flap'),
  ('bite', 'Bite'),
  ('tail_whip', 'Tail Whip'),
  ('scratch', 'Scratch'),
  ('pounce', 'Pounce')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
