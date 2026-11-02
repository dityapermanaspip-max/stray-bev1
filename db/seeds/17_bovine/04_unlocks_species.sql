-- Bovine unlocks (tier 2 at the parent's lv6-8, tier 3 at lv10, tier 4 at lv13; Juggernaut is a combo), the bull's
-- new body parts and pool (the whole tree plus kick), and display names. Hooves grow from Paw the Ground, not Kick:
-- players know Kick, and a player rule would teach them bull moves.
INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', x.kind, jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('horn_toss','mastery','gore',7), ('hook_horn','mastery','gore',8),
  ('shoulder_ram','mastery','charge',7), ('thick_hide','mastery','charge',6),
  ('stomp','mastery','paw_ground',7), ('back_kick','mastery','paw_ground',8),
  ('tail_swish','mastery','bellow',6), ('snort','mastery','bellow',7), ('rage','mastery','bellow',8),
  ('impale','mastery','hook_horn',10), ('sweep_horns','mastery','horn_toss',10),
  ('stampede','mastery','shoulder_ram',10), ('trample','mastery','stomp',10), ('ground_pound','mastery','back_kick',10),
  ('seeing_red','mastery','rage',10), ('war_bellow','mastery','snort',10),
  ('skewer','mastery','impale',13),
  -- combo: both rows in group a must pass
  ('juggernaut','combo','stampede',13), ('juggernaut','combo','thick_hide',10)
) AS x(move_name, kind, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (
  SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a' AND u.params->>'move' = x.parent
);

UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['voice','tail']) AS p)
WHERE species_name = 'bull' AND NOT (body_parts @> ARRAY['voice','tail']);

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('charge'), ('gore'), ('kick'), ('bellow'), ('paw_ground'),
  ('horn_toss'), ('hook_horn'), ('shoulder_ram'), ('thick_hide'), ('stomp'), ('back_kick'),
  ('tail_swish'), ('snort'), ('rage'),
  ('impale'), ('sweep_horns'), ('stampede'), ('trample'), ('ground_pound'), ('seeing_red'), ('war_bellow'),
  ('skewer'), ('juggernaut')
) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN entity.species s ON s.species_name = 'bull'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('bellow', 'Bellow'), ('paw_ground', 'Paw the Ground'), ('horn_toss', 'Horn Toss'), ('hook_horn', 'Hook Horn'),
  ('shoulder_ram', 'Shoulder Ram'), ('thick_hide', 'Thick Hide'), ('stomp', 'Stomp'), ('back_kick', 'Back Kick'),
  ('tail_swish', 'Tail Swish'), ('snort', 'Snort'), ('rage', 'Rage'), ('impale', 'Impale'),
  ('sweep_horns', 'Sweep Horns'), ('stampede', 'Stampede'), ('trample', 'Trample'), ('ground_pound', 'Ground Pound'),
  ('seeing_red', 'Seeing Red'), ('war_bellow', 'War Bellow'), ('skewer', 'Skewer'), ('juggernaut', 'Juggernaut')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
