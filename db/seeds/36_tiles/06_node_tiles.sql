-- Which big obstacles stand for which resource node (2026-11-03). Where the node has no landmark in the field's own
-- biome, the 'any' ones (cave mouth, camp) stand in.
UPDATE world.tiles SET node_kind = x.kind
FROM (VALUES
  ('rock', 'desert_rock_stack'), ('rock', 'desert_black_crystal'), ('rock', 'desert_white_crystal'),
  ('rock', 'snow_cairn'), ('rock', 'snow_cairn_moss'), ('rock', 'snow_crystal'), ('rock', 'snow_crystal_moss'),
  ('tree', 'desert_dead_tree'), ('tree', 'snow_tree'), ('tree', 'snow_tree_moss'), ('tree', 'snow_grove'), ('tree', 'snow_grove_moss'),
  ('herb', 'desert_cactus'),
  ('cave', 'cave_mouth'), ('camp', 'camp_fire_logs'), ('camp', 'camp_tent')
) AS x(kind, tile_key)
WHERE world.tiles.tile_key = x.tile_key;
UPDATE world.tiles SET biome = 'any' WHERE tile_key IN ('cave_mouth', 'camp_fire_logs', 'camp_tent');
