-- Who lives in each biome (weights split a hex's creature cap). Pilot mix; content work refines it.
INSERT INTO world.biome_species (biome_id, species_id, weight)
SELECT b.id, s.id, x.weight FROM (VALUES
  ('meadow', 'chicken', 5), ('meadow', 'cat', 2), ('meadow', 'lizard', 2), ('meadow', 'bull', 1),
  ('grove', 'cat', 3), ('grove', 'lizard', 2), ('grove', 'bear', 2), ('grove', 'chicken', 1),
  ('desert', 'lizard', 4), ('desert', 'ostrich', 3),
  ('snow', 'bear', 3), ('snow', 'cat', 1),
  ('volcano', 'lizard', 3), ('volcano', 'bull', 1),
  ('battlefield', 'chicken', 2), ('battlefield', 'cat', 2), ('battlefield', 'bull', 2), ('battlefield', 'bear', 1),
  ('seashore', 'chicken', 2), ('seashore', 'lizard', 3), ('seashore', 'ostrich', 1)
) AS x(biome, species, weight)
JOIN world.biomes b ON b.biome_name = x.biome JOIN entity.species s ON s.species_name = x.species
ON CONFLICT DO NOTHING;
