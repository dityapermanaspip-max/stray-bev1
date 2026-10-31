-- World generation (Step 4, hidden). `npm run world:new -- --seed N` makes a new round from these rules.
-- corridors: [min, max] corridor fields per border. towns: towns per ring; town_spacing: least hex distance between
-- two towns. centre_biome: the boss hex (ring 0). biomes: per ring, biome weights; clump: each neighbor that already
-- has a biome multiplies its weight by (1 + clump), so biomes grow in patches. hex_max: creatures a wild hex holds,
-- split over the species of its ring; safe_share: the safe floor share of max. town: purse per person, max_buy and
-- population per ring, specialties per biome (item goods families), job shares. vice_rings: rings the 6 starting
-- vices are placed in, inner first.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('world.gen', '{
  "corridors": [3, 7],
  "towns": {"4": 6, "3": 4, "2": 3, "1": 2},
  "town_spacing": 2,
  "centre_biome": "volcano",
  "biomes": {
    "4": {"seashore": 3, "meadow": 3, "grove": 2, "desert": 1},
    "3": {"meadow": 2, "grove": 2, "desert": 2, "snow": 2, "battlefield": 1},
    "2": {"battlefield": 3, "snow": 2, "desert": 2, "volcano": 1},
    "1": {"battlefield": 2, "volcano": 3, "snow": 1}
  },
  "clump": 1.5,
  "hex_max": 10000,
  "safe_share": 0.08,
  "town": {
    "purse_per_person": 10,
    "max_buy": {"4": 100, "3": 200, "2": 400, "1": 800},
    "population": {"4": 300, "3": 600, "2": 1200, "1": 2400},
    "specialties": {
      "meadow": ["chicken", "lizard"], "grove": ["wood", "cat"], "desert": ["lizard"], "snow": ["wood"],
      "volcano": [], "battlefield": ["leather"], "seashore": ["chicken"]
    },
    "jobs": {"farmer": 0.20, "laborer": 0.03, "guard": 0.08, "hunter": 0.36, "woodcutter": 0.12, "tanner": 0.08, "cook": 0.07, "woodworker": 0.06}
  },
  "vice_rings": [1, 2]
}', 'World generation rules: corridors per border, towns per ring and spacing, biomes per ring with clumping, hex creature max and safe share, town economy defaults, vice rings.')
ON CONFLICT (config_key) DO NOTHING;
