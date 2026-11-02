-- The lizard's new body parts, its whole pool, and display names.
UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['scales','voice']) AS p)
WHERE species_name = 'lizard' AND NOT (body_parts @> ARRAY['scales','voice']);

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id FROM (VALUES ('bite'), ('tail_whip'), ('hiss'), ('scurry'), ('claw_rake'), ('bask'), ('snap_bite'), ('lockjaw'), ('tail_sweep'), ('tail_drop'), ('tear'), ('harden_scales'), ('frill_flare'), ('death_roll'), ('crushing_jaws'), ('club_tail'), ('gut_rake'), ('stone_scales'), ('primal_bite'), ('thrash')) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name JOIN entity.species s ON s.species_name = 'lizard'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_scurry','Scurry'), ('move_name_claw_rake','Claw Rake'), ('move_name_bask','Bask'), ('move_name_snap_bite','Snap Bite'), ('move_name_lockjaw','Lockjaw'), ('move_name_tail_sweep','Tail Sweep'), ('move_name_tail_drop','Tail Drop'), ('move_name_tear','Tear'), ('move_name_harden_scales','Harden Scales'), ('move_name_frill_flare','Frill Flare'), ('move_name_death_roll','Death Roll'), ('move_name_crushing_jaws','Crushing Jaws'), ('move_name_club_tail','Club Tail'), ('move_name_gut_rake','Gut Rake'), ('move_name_stone_scales','Stone Scales'), ('move_name_primal_bite','Primal Bite'), ('move_name_thrash','Thrash')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
