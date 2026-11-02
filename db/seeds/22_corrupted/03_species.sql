-- Which species may roll which corrupted-only moves.
INSERT INTO entity.species_moves (species_id, move_id, corrupted_only)
SELECT s.id, m.id, true FROM (VALUES ('chicken','rot_peck'), ('chicken','dread_squawk'), ('rooster','rot_peck'), ('rooster','dread_squawk'), ('rooster','blight_spur'), ('ostrich','rot_peck'), ('ostrich','dread_squawk'), ('ostrich','mad_dash'), ('volcano_chicken','rot_peck'), ('volcano_chicken','dread_squawk'), ('volcano_chicken','brimstone_breath'), ('cat','plague_claws'), ('cat','night_terror'), ('cat','hollow_bite'), ('bull','rotting_horns'), ('bull','black_stampede'), ('bull','mad_bellow'), ('lizard','venom_bite'), ('lizard','bile_spit'), ('lizard','cold_blood'), ('bear','rabid_bite'), ('bear','blood_frenzy'), ('bear','carrion_roar')) AS x(species_name, move_name)
JOIN entity.species s ON s.species_name = x.species_name JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (species_id, move_id) DO UPDATE SET corrupted_only = true;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_rot_peck','Rot Peck'), ('move_name_dread_squawk','Dread Squawk'), ('move_name_blight_spur','Blight Spur'), ('move_name_mad_dash','Mad Dash'), ('move_name_brimstone_breath','Brimstone Breath'), ('move_name_plague_claws','Plague Claws'), ('move_name_night_terror','Night Terror'), ('move_name_hollow_bite','Hollow Bite'), ('move_name_rotting_horns','Rotting Horns'), ('move_name_black_stampede','Black Stampede'), ('move_name_mad_bellow','Mad Bellow'), ('move_name_venom_bite','Venom Bite'), ('move_name_bile_spit','Bile Spit'), ('move_name_cold_blood','Cold Blood'), ('move_name_rabid_bite','Rabid Bite'), ('move_name_blood_frenzy','Blood Frenzy'), ('move_name_carrion_roar','Carrion Roar')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
