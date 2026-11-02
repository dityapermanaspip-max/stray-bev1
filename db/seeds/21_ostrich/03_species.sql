-- The ostrich's new body parts, its whole pool, and display names.
UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['voice']) AS p)
WHERE species_name = 'ostrich' AND NOT (body_parts @> ARRAY['voice']);

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id FROM (VALUES ('peck'), ('wing_flap'), ('flutter'), ('claw_kick'), ('squawk'), ('triple_peck'), ('eye_peck'), ('grain_snack'), ('wing_buffet'), ('dust_bath'), ('flutter_back'), ('talon_rake'), ('hop_kick'), ('puff_up'), ('alarm_cry'), ('peck_flurry'), ('skull_peck'), ('gale_wings'), ('feather_storm'), ('flying_kick'), ('peck_storm'), ('kick'), ('sprint'), ('long_stride'), ('talon_kick'), ('gutting_kick'), ('dust_trail'), ('thunder_kick')) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name JOIN entity.species s ON s.species_name = 'ostrich'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_sprint','Sprint'), ('move_name_long_stride','Long Stride'), ('move_name_talon_kick','Talon Kick'), ('move_name_gutting_kick','Gutting Kick'), ('move_name_dust_trail','Dust Trail'), ('move_name_thunder_kick','Thunder Kick')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
