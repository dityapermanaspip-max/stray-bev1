-- Dev world until world generation (Step 4): one round, a meadow hex and a grove hex,
-- joined by three corridors that shift from meadow to grove. Fixed populations for encounters (2d).

INSERT INTO world.rounds (status, seed)
SELECT 'dev', 1 WHERE NOT EXISTS (SELECT 1 FROM world.rounds WHERE status = 'dev');

INSERT INTO world.hexes (round_id, q, r, ring, field_kind, field_template, field_seed, biome)
SELECT r.id, x.q, x.r, 1, 'open', 'open_field', x.seed, x.biome
FROM world.rounds r, (VALUES (0, 0, 101, 'meadow'), (1, 0, 202, 'grove')) AS x(q, r, seed, biome)
WHERE r.status = 'dev'
ON CONFLICT (round_id, q, r) DO NOTHING;

INSERT INTO world.borders (round_id, hex_a, hex_b, corridor_count)
SELECT r.id, a.id, b.id, 3
FROM world.rounds r
JOIN world.hexes a ON a.round_id = r.id AND a.q = 0 AND a.r = 0
JOIN world.hexes b ON b.round_id = r.id AND b.q = 1 AND b.r = 0
WHERE r.status = 'dev'
ON CONFLICT (hex_a, hex_b) DO NOTHING;

INSERT INTO world.corridors (border_id, position, template, seed)
SELECT bo.id, x.position, 'corridor_path', x.seed
FROM world.borders bo
JOIN world.rounds r ON r.id = bo.round_id AND r.status = 'dev',
(VALUES (1, 301), (2, 302), (3, 303)) AS x(position, seed)
ON CONFLICT (border_id, position) DO NOTHING;

INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
SELECT h.id::text, s.id, x.native_n, x.corrupted_n, x.safe_n, x.max_n
FROM world.hexes h
JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
JOIN (VALUES
  (0, 'chicken', 12, 2, 4, 20), (0, 'cat', 5, 1, 2, 10), (0, 'lizard', 3, 4, 1, 8),
  (1, 'cat', 8, 3, 3, 12), (1, 'lizard', 6, 2, 2, 10)
) AS x(q, species, native_n, corrupted_n, safe_n, max_n) ON x.q = h.q AND h.r = 0
JOIN entity.species s ON s.species_name = x.species
ON CONFLICT (field_ref, species_id) DO NOTHING;
