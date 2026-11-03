-- Tile catalog, fourth batch (2026-11-03): crafts, room structure seen from INSIDE the room, loft pieces, scenes, volcano landmarks.
-- Descriptions are written to be read when the map is reseeded: what it is, where it fits, how it behaves (walk / block / obstacle).
-- Only the usable tiles of each sheet are catalogued; the other cells are skipped (duplicates, outside-view walls, whole-room dioramas
-- that need a corner of their own are kept as 'scene' pieces). Spare sheets: catalog/sheets/spare.
INSERT INTO world.tiles (tile_key, atlas, terrain, biome, walkable, sheet, cell, description, node_kind)
SELECT x.tile_key, x.atlas, x.terrain, x.biome, x.atlas = 'walk', x.sheet, x.cell, x.description, x.node_kind
FROM (VALUES
  -- crafts: workshop pieces on flagstones (smith, kitchen, butcher, tanner, carpenter). Each is one object on a stone floor tile.
  ('craft_anvil',        'obstacle', 'anvil',          'interior', 'crafts', 0,  'Smithy: an anvil on a tree stump with a hammer. Put beside the forge.', NULL),
  ('craft_forge',        'obstacle', 'forge',          'interior', 'crafts', 1,  'Smithy: brick forge with glowing coals and bellows. Heat source of a smithy, one tile.', NULL),
  ('craft_quench_tub',   'obstacle', 'quench_tub',     'interior', 'crafts', 2,  'Smithy: wooden tub of water with tongs. Stands next to anvil or forge.', NULL),
  ('craft_stove',        'obstacle', 'stove',          'interior', 'crafts', 3,  'Kitchen: iron cooking stove with copper pots. Inn kitchen or a cook house.', NULL),
  ('craft_chop_table',   'obstacle', 'chopping_table', 'interior', 'crafts', 4,  'Kitchen: wooden table with vegetables, knife and board. Next to the stove.', NULL),
  ('craft_meat_rack',    'obstacle', 'meat_rack',      'interior', 'crafts', 5,  'Butcher: a frame hung with ham and sausages. Butcher shop, larder.', NULL),
  ('craft_hide_rack',    'obstacle', 'hide_rack',      'interior', 'crafts', 6,  'Tanner: a stretching frame with a hide. Tannery, hunter hut.', NULL),
  ('craft_pelts',        'walk',     'pelt_rug',       'interior', 'crafts', 7,  'Flat fur pelts laid on the floor, walkable. Hunter hut, tannery, a chief''s room.', NULL),
  ('craft_workbench',    'obstacle', 'workbench',      'interior', 'crafts', 8,  'Carpenter: workbench with vice, mallet and chisels. Any workshop.', NULL),
  ('craft_sawhorse',     'obstacle', 'sawhorse',       'interior', 'crafts', 9,  'Carpenter: sawhorse with a two-handed saw. Beside the workbench.', NULL),
  ('craft_tool_wall',    'obstacle', 'tool_wall',      'interior', 'crafts', 10, 'A low brick wall piece with hammers and pliers hung on a rail. Back of any workshop.', NULL),
  ('craft_grindstone',   'obstacle', 'grindstone',     'interior', 'crafts', 11, 'A foot-driven grinding wheel on a frame. Smithy, armourer.', NULL),
  ('craft_water_barrel', 'obstacle', 'water_barrel',   'interior', 'crafts', 12, 'Open barrel of water with its lid beside it. Any workshop or yard.', NULL),
  ('floor_soot',         'walk',     'floor_soot',     'interior', 'crafts', 13, 'Flagstones blackened with soot, walkable. Floor under a forge or fireplace.', NULL),
  ('floor_straw_pile',   'walk',     'straw_pile',     'interior', 'crafts', 14, 'A heap of straw on flagstones, walkable. Stable, cell bedding, barn.', NULL),
  -- scenes_12: whole corner diorama (two back walls and the furniture in one tile) and a pew set. Corner pieces: place only at a room's back corner.
  ('scene_alchemist',    'obstacle', 'scene_alchemist','interior', 'scenes_12', 0, 'Corner scene: alchemist lab (bench with flasks, still, furnace, shelf of books). Back corner of a potion shop.', NULL),
  ('scene_chapel',       'obstacle', 'scene_chapel',   'interior', 'scenes_12', 1, 'Corner scene: stone chapel with a lit altar, an icon, an open book and a censer. Back corner of a temple.', NULL),
  ('scene_cell',         'obstacle', 'scene_cell',     'interior', 'scenes_12', 2, 'Corner scene: dark prison cell (barred door, cot, chains, bucket). Back corner of a jail or a captive''s room.', NULL),
  ('pews_censer',        'obstacle', 'pews',           'interior', 'scenes_12', 4, 'Four wooden chairs in a block with a censer. Temple or guild hall seating, one tile.', NULL),
  -- room_in: walls of a room seen from INSIDE (floor and the two back walls drawn together). Back-wall pieces; the block atlas.
  ('wall_in_door',       'block',    'wall_door',      'interior', 'room_in', 1,  'Back wall with an arched wooden door and a stone threshold, brick. Marks a door in the back wall (decoration, the exit stays the door mat).', NULL),
  ('wall_in_window',     'block',    'wall_window',    'interior', 'room_in', 2,  'Back wall of red brick with a small window, shutters folded open, a candle on the sill.', NULL),
  ('wall_in_brick_a',    'block',    'wall_brick_in',  'interior', 'room_in', 3,  'Back wall of plain tan brick, corner of the room. The ordinary wall.', NULL),
  ('wall_in_brick_b',    'block',    'wall_brick_in',  'interior', 'room_in', 4,  'Back wall of plain tan brick, a second brick pattern for variety.', NULL),
  ('wall_in_plaster',    'block',    'wall_plaster_in','interior', 'room_in', 5,  'Back wall of cream plaster with a dark skirting board. Homes, inns.', NULL),
  ('wall_in_timber',     'block',    'wall_timber_in', 'interior', 'room_in', 6,  'Back wall of cream plaster in a dark timber frame (half-timbered). Inns, merchants.', NULL),
  ('wall_in_stone',      'block',    'wall_stone_in',  'interior', 'room_in', 7,  'Back wall of grey fitted stone. Guild, temple, cellar.', NULL),
  ('wall_in_banner',     'block',    'wall_banner',    'interior', 'room_in', 9,  'Back wall of cream plaster with a small red banner. Guild hall, trainer.', NULL),
  ('wall_in_fireplace',  'obstacle', 'fireplace_wall', 'interior', 'room_in', 10, 'A brick fireplace set in the back wall with a pot over the fire. The room''s hearth; blocks the tile.', NULL),
  -- room_flat: flat floor pieces and furniture on wooden planks (no walls drawn)
  ('floor_door_mat',     'walk',     'door_mat',       'interior', 'room_flat', 0,  'A woven mat on planks. The tile under the room''s exit door: it says "leave here".', NULL),
  ('stairs_up',          'obstacle', 'stairs',         'interior', 'room_flat', 8,  'Wooden staircase of five steps going up to the back. A loft or an upper floor (decoration for now).', NULL),
  ('pillar_wood',        'obstacle', 'pillar',         'interior', 'room_flat', 10, 'Round wooden pillar on a stone base with a carved cap. Holds a beam; blocks the tile.', NULL),
  ('rug_runner',         'walk',     'rug_runner',     'interior', 'room_flat', 11, 'A long red rug with a gold pattern, walkable. A path from the door to the counter.', NULL),
  ('candle_stand',       'obstacle', 'candle_stand',   'interior', 'room_flat', 12, 'A tall iron stand with three lit candles on planks. Light and mood; blocks the tile.', NULL),
  ('trapdoor_open',      'obstacle', 'trapdoor',       'interior', 'room_flat', 14, 'An open trapdoor with a ladder going down into the dark. A cellar entrance (decoration for now).', NULL),
  -- room_loft: planks, a loft frame, a chimney, floor joists (the open upper floor)
  ('floor_planks_beams', 'walk',     'floor_planks',   'interior', 'room_loft', 0,  'Wooden planks with two cross beams laid over them, walkable. Plain floor, loft level.', NULL),
  ('loft_frame',         'obstacle', 'loft_frame',     'interior', 'room_loft', 8,  'A timber scaffold with a platform and a rail: an unfinished loft. Barn, workshop.', NULL),
  ('chimney_brick',      'obstacle', 'chimney',        'interior', 'room_loft', 9,  'A brick chimney stack on planks. Beside a hearth.', NULL),
  ('joists_open_a',      'block',    'floor_open',     'interior', 'room_loft', 10, 'Bare floor joists with a dark gap below: a hole in the floor, cannot be crossed.', NULL),
  ('joists_open_b',      'block',    'floor_open',     'interior', 'room_loft', 11, 'Bare floor joists, second pattern. Same use as joists_open_a.', NULL),
  ('joists_open_c',      'block',    'floor_open',     'interior', 'room_loft', 12, 'Bare floor joists, third pattern. Same use as joists_open_a.', NULL),
  -- big_volcano: dark landmarks on black rock (volcano fields; two are cave pieces)
  ('volcano_rune_gate',  'obstacle', 'rune_gate',      'volcano', 'big_volcano', 0, 'A huge rune-carved stone gate glowing orange, lava at its foot. Landmark of a sealed place.', NULL),
  ('volcano_rock_stack', 'obstacle', 'rock_stack',     'volcano', 'big_volcano', 1, 'Balanced brown boulders around a spire. A rock node in a volcano field.', 'rock'),
  ('volcano_mushrooms',  'obstacle', 'glow_grove',     'volcano', 'big_volcano', 2, 'Teal glowing mushrooms among pale stalagmites. A herb node in a volcano field.', 'herb'),
  ('volcano_ruin',       'obstacle', 'ruin_arch',      'volcano', 'big_volcano', 3, 'A broken dwarven stone arch with carved panels. A ruin to walk around.', NULL),
  ('volcano_bones',      'obstacle', 'giant_bones',    'volcano', 'big_volcano', 4, 'A huge beast skeleton on black rock. Decoration landmark.', NULL),
  ('volcano_dead_tree',  'obstacle', 'dead_tree_big',  'volcano', 'big_volcano', 5, 'A bare dead tree with thin branches. A tree node in a volcano field.', 'tree'),
  ('volcano_obsidian',   'obstacle', 'obsidian',       'volcano', 'big_volcano', 6, 'Black glass spires with glowing orange cracks. A rock node in a volcano field.', 'rock'),
  ('cave_geode',         'obstacle', 'geode',          'cave',    'big_volcano', 7, 'A cluster of purple and green crystals with gold nuggets and flowers. A rich find; cave or volcano.', NULL),
  ('cave_mine_cart',     'obstacle', 'mine_cart',      'cave',    'big_volcano', 8, 'An old mine cart on rails next to a water wheel and a stream. A mine scene; cave or volcano.', NULL)
) AS x(tile_key, atlas, terrain, biome, sheet, cell, description, node_kind)
ON CONFLICT DO NOTHING;
