-- Rooms with the second batch of art: a sand floor for the training ground, the camp on trampled grass among trees.
UPDATE config.balance_config SET value = value
  || jsonb_build_object('rooms', (value->'rooms')
  || jsonb_build_object('trainer', (value->'rooms'->'trainer') || '{"floor":"sand_floor"}'::jsonb)
  || jsonb_build_object('camp', (value->'rooms'->'camp') || '{"floor":"camp_ground","wall":"camp_trees",
       "props":[{"terrain":"campfire","x":4,"y":3},{"terrain":"log","x":2,"y":4},{"terrain":"tent","x":6,"y":2},{"terrain":"woodpile","x":6,"y":5}]}'::jsonb))
WHERE config_key = 'interior';
