-- Height blocks (2026-11-02): no more slopes. Heights 0-5, a step may rise or drop one level (server/field/climb.ts).
-- hills.max per biome: highest level. slope_share is gone. Field layouts come from seeds, so stored rounds take the
-- new layouts when the game server next builds them.
UPDATE world.biomes SET params = (params - 'slope_share') || jsonb_build_object('hills', params->'hills' || jsonb_build_object('max', v.max))
FROM (VALUES ('meadow', 3), ('grove', 4), ('desert', 3), ('snow', 4), ('volcano', 5), ('battlefield', 2), ('seashore', 2)) AS v(name, max)
WHERE world.biomes.biome_name = v.name;
