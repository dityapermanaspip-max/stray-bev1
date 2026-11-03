-- Small rooms (2026-11-03): shop, inn and training ground inside a town, camp and cave in the wild. Tiles at x = 0
-- or y = 0 are back walls (wall null: none), the exit is the middle of the last row. props are blocked furniture.
-- keeper: where the door's NPC stands; guests: seats for the town's recruits; rest: a tile that asks "rest here?".
-- wild: resting there costs rest_price copper and creatures come now and then (ambush_permille per rest).
INSERT INTO config.balance_config (config_key, value, description) VALUES
('interior', '{
  "rooms": {
    "shop": {"biome": "interior", "w": 9, "h": 9, "floor": "floor_wood", "wall": "wall_wood",
      "props": [{"terrain": "shelf", "x": 1, "y": 1, "w": 7}, {"terrain": "counter", "x": 1, "y": 3, "w": 3}, {"terrain": "counter", "x": 5, "y": 3, "w": 3}],
      "keeper": {"x": 4, "y": 3}, "guests": [], "rest": null},
    "inn": {"biome": "interior", "w": 11, "h": 9, "floor": "floor_wood", "wall": "wall_wood",
      "props": [{"terrain": "hearth", "x": 4, "y": 1, "w": 3}, {"terrain": "counter", "x": 1, "y": 3, "w": 3}, {"terrain": "counter", "x": 5, "y": 3, "w": 4},
        {"terrain": "table", "x": 2, "y": 6}, {"terrain": "table", "x": 8, "y": 6}],
      "keeper": {"x": 4, "y": 3}, "guests": [{"x": 3, "y": 6}, {"x": 7, "y": 6}, {"x": 9, "y": 5}, {"x": 1, "y": 5}], "rest": null},
    "trainer": {"biome": "interior", "w": 11, "h": 9, "floor": "floor_sand", "wall": "wall_wood",
      "props": [{"terrain": "rack", "x": 1, "y": 1, "w": 9}, {"terrain": "dummy", "x": 3, "y": 3}, {"terrain": "dummy", "x": 7, "y": 3}],
      "keeper": {"x": 5, "y": 4}, "guests": [], "rest": null},
    "camp": {"biome": "camp", "w": 9, "h": 9, "floor": "camp_ground", "wall": "camp_trees",
      "props": [{"terrain": "campfire", "x": 4, "y": 3}, {"terrain": "log", "x": 2, "y": 3}, {"terrain": "log", "x": 6, "y": 3}],
      "keeper": null, "guests": [], "rest": {"x": 4, "y": 5, "service": "camp"}},
    "cave": {"biome": "cave", "w": 9, "h": 9, "floor": "cave_floor", "wall": "cave_wall",
      "props": [{"terrain": "stalagmite", "x": 2, "y": 2}, {"terrain": "stalagmite", "x": 6, "y": 4}, {"terrain": "stalagmite", "x": 7, "y": 2}],
      "keeper": null, "guests": [], "rest": {"x": 4, "y": 2, "service": "cave"}}
  },
  "wild": {"camp": {"rest_price": 0, "ambush_permille": 150}, "cave": {"rest_price": 0, "ambush_permille": 60}}
}', 'Small rooms: town service interiors and wild camps and caves (layout, seats, resting in the wild).')
ON CONFLICT (config_key) DO NOTHING;
