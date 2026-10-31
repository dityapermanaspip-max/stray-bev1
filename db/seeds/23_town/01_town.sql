-- Towns (Step 3). A town hex is a normal-size field with a safe 16x16 square in the middle: flat, a road
-- cross, and buildings with one door each (the door opens the service). The wild edge around it is a meadow.
INSERT INTO world.field_templates (template_name, kind, width, height, params) VALUES
('town_square', 'town', 20, 20, '{"obstacle_mult":1,"town":{"safe":16,"height":0,"ground":"paving","road":"road",
  "building":"building","door":"door","buildings":[{"service":"inn","w":4,"h":3},{"service":"shop","w":3,"h":3},
  {"service":"temple","w":3,"h":3},{"service":"guild","w":3,"h":3},{"service":"trainer","w":3,"h":3}]}}')
ON CONFLICT (template_name) DO NOTHING;

-- Dev world: the town west of the meadow (q -1), three corridors between them (borders hold 3 to 7). New players start here.
INSERT INTO world.hexes (round_id, q, r, ring, field_kind, field_template, field_seed, biome)
SELECT r.id, -1, 0, 1, 'town', 'town_square', 404, 'meadow'
FROM world.rounds r WHERE r.status = 'dev'
ON CONFLICT (round_id, q, r) DO NOTHING;

INSERT INTO world.borders (round_id, hex_a, hex_b, corridor_count)
SELECT r.id, a.id, b.id, 3
FROM world.rounds r
JOIN world.hexes a ON a.round_id = r.id AND a.q = -1 AND a.r = 0
JOIN world.hexes b ON b.round_id = r.id AND b.q = 0 AND b.r = 0
WHERE r.status = 'dev'
ON CONFLICT (hex_a, hex_b) DO NOTHING;

INSERT INTO world.corridors (border_id, position, template, seed)
SELECT bo.id, x.position, 'corridor_path', x.seed
FROM world.borders bo
JOIN world.rounds r ON r.id = bo.round_id AND r.status = 'dev'
JOIN world.hexes a ON a.id = bo.hex_a AND a.q = -1,
(VALUES (1, 305), (2, 306), (3, 307)) AS x(position, seed)
ON CONFLICT (border_id, position) DO NOTHING;

-- Small wildlife on the town's wild edge (the square itself never rolls encounters).
INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
SELECT h.id::text, s.id, 300, 0, 100, 3000
FROM world.hexes h
JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
JOIN entity.species s ON s.species_name = 'chicken'
WHERE h.q = -1 AND h.r = 0
ON CONFLICT (field_ref, species_id) DO NOTHING;

-- Swaps now happen only in towns. The inn price and a new player's purse (copper).
UPDATE config.balance_config SET value = 'false', description = 'Testing flag: true allows loadout and gear swaps outside towns.'
WHERE config_key = 'loadout_swap_anywhere';
INSERT INTO config.balance_config (config_key, value, description) VALUES
('town.inn', '{"price":20}', 'Copper for a night at the inn (body fully rested).'),
('player_start_copper', '50', 'Copper a newly Summoned player carries.')
ON CONFLICT (config_key) DO NOTHING;
