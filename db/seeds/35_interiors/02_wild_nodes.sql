-- A camp or a cave now and then in the wild (field nodes like rocks; a tile you walk beside and go into).
UPDATE world.biomes b SET params = jsonb_set(b.params, '{nodes}', COALESCE(b.params->'nodes', '{}'::jsonb) || x.nodes::jsonb)
FROM (VALUES
  ('meadow', '{"camp":1}'), ('grove', '{"camp":1}'), ('battlefield', '{"camp":1}'), ('seashore', '{"camp":1}'),
  ('snow', '{"cave":1}'), ('volcano', '{"cave":1}'), ('desert', '{"cave":1}')
) AS x(biome, nodes)
WHERE b.biome_name = x.biome;
