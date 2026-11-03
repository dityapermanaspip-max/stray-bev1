-- Biome connector rank (2026-11-04): where two biomes meet in a corridor, the lower-ranked biome wears a half-and-half
-- connector tile toward the harsher one; the harsher biome stays plain (one-sided rule). Order: gentle first, harsh last.
INSERT INTO config.balance_config (config_key, value)
VALUES ('biome_blend', '{"rank": ["meadow", "grove", "seashore", "desert", "snow", "battlefield", "volcano"]}')
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;
