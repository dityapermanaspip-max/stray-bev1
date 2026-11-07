-- Small rooms for the rest of the town doors (2026-11-08): each craftsman, the temple and the guild get a room with
-- their keeper inside (the shopkeeper's sheet until more characters exist). Props use the crafts/interior catalog terrains.
-- Craftsmen open their recipes by talking to the keeper (Trade); temple and guild stay closed until their steps.
UPDATE config.balance_config
SET value = jsonb_set(value, '{rooms}', (value->'rooms') || '{
  "blacksmith": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_soot", "wall": "wall_brick",
    "props": [{"terrain": "tool_wall", "x": 1, "y": 1, "w": 7}, {"terrain": "forge", "x": 2, "y": 2}, {"terrain": "anvil", "x": 4, "y": 2},
      {"terrain": "quench_tub", "x": 6, "y": 2}, {"terrain": "grindstone", "x": 7, "y": 5}, {"terrain": "water_barrel", "x": 1, "y": 5}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "cook": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_planks", "wall": "wall_brick",
    "props": [{"terrain": "stove", "x": 1, "y": 1, "w": 3}, {"terrain": "chopping_table", "x": 5, "y": 1, "w": 3}, {"terrain": "table", "x": 2, "y": 5},
      {"terrain": "table", "x": 6, "y": 5}, {"terrain": "water_barrel", "x": 7, "y": 3}],
    "keeper": {"x": 4, "y": 2, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "herbalist": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_planks", "wall": "wall_brick",
    "props": [{"terrain": "shelf", "x": 1, "y": 1, "w": 7}, {"terrain": "table", "x": 2, "y": 3}, {"terrain": "table", "x": 6, "y": 3},
      {"terrain": "water_barrel", "x": 1, "y": 6}, {"terrain": "candle_stand", "x": 7, "y": 6}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "tanner": {"biome": "interior", "w": 9, "h": 9, "floor": "sand_floor", "wall": "wall_brick",
    "props": [{"terrain": "hide_rack", "x": 1, "y": 1}, {"terrain": "hide_rack", "x": 3, "y": 1}, {"terrain": "meat_rack", "x": 5, "y": 1, "w": 3},
      {"terrain": "workbench", "x": 6, "y": 4, "w": 2}, {"terrain": "water_barrel", "x": 1, "y": 5}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "woodworker": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_planks", "wall": "wall_brick",
    "props": [{"terrain": "tool_wall", "x": 1, "y": 1, "w": 7}, {"terrain": "workbench", "x": 2, "y": 2, "w": 2}, {"terrain": "workbench", "x": 6, "y": 2},
      {"terrain": "sawhorse", "x": 2, "y": 5}, {"terrain": "sawhorse", "x": 6, "y": 5}, {"terrain": "loft_frame", "x": 7, "y": 6}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "temple": {"biome": "interior", "w": 9, "h": 9, "floor": "sand_floor", "wall": "wall_brick",
    "props": [{"terrain": "scene_chapel", "x": 4, "y": 1}, {"terrain": "candle_stand", "x": 2, "y": 2}, {"terrain": "candle_stand", "x": 6, "y": 2},
      {"terrain": "pews", "x": 2, "y": 5}, {"terrain": "pews", "x": 6, "y": 5}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null},
  "guild": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_planks", "wall": "wall_brick",
    "props": [{"terrain": "rack", "x": 1, "y": 1, "w": 7}, {"terrain": "counter", "x": 2, "y": 3, "w": 2}, {"terrain": "counter", "x": 5, "y": 3, "w": 2},
      {"terrain": "table", "x": 2, "y": 6}, {"terrain": "table", "x": 6, "y": 6}, {"terrain": "candle_stand", "x": 7, "y": 2}],
    "keeper": {"x": 4, "y": 3, "look": "characters/human/shopkeeper/shopkeeper"}, "guests": [], "rest": null}
}'::jsonb),
updated_at = now()
WHERE config_key = 'interior';
