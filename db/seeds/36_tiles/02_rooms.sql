-- Rooms use catalog terrains now (36_tiles/01_catalog.sql). Props without art yet (shelf, counter, table, rack, dummy,
-- camp_trees, cave_wall, stalagmite) keep drawing as plain colour blocks until a tile is added with that terrain.
UPDATE config.balance_config SET value = value
  || jsonb_build_object('rooms', (value->'rooms')
  || jsonb_build_object('shop', (value->'rooms'->'shop') || '{"floor":"floor_planks","wall":"wall_brick"}'::jsonb)
  || jsonb_build_object('inn', (value->'rooms'->'inn') || '{"floor":"floor_planks","wall":"wall_brick",
       "props":[{"terrain":"hearth","x":5,"y":1},{"terrain":"counter","x":1,"y":3,"w":3},{"terrain":"counter","x":5,"y":3,"w":4},
                {"terrain":"table","x":2,"y":6},{"terrain":"table","x":8,"y":6}]}'::jsonb)
  || jsonb_build_object('trainer', (value->'rooms'->'trainer') || '{"floor":"sand","wall":"wall_brick"}'::jsonb)
  || jsonb_build_object('camp', (value->'rooms'->'camp') || '{"floor":"sand",
       "props":[{"terrain":"campfire","x":4,"y":3},{"terrain":"camp_pack","x":2,"y":3},{"terrain":"tent","x":6,"y":2}]}'::jsonb)
  || jsonb_build_object('cave', (value->'rooms'->'cave') || '{"floor":"cave_floor"}'::jsonb))
WHERE config_key = 'interior';
