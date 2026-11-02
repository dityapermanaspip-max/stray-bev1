-- The bear's new body parts, its whole pool, and display names.
UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['voice']) AS p)
WHERE species_name = 'bear' AND NOT (body_parts @> ARRAY['voice']);

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id FROM (VALUES ('maul'), ('bite'), ('scratch'), ('roar'), ('rear_up'), ('swat'), ('rend'), ('crunch'), ('chomp'), ('bear_hug'), ('thick_fur'), ('terrifying_roar'), ('savage_maul'), ('bone_crusher'), ('crushing_hug'), ('ground_slam'), ('lick_wounds'), ('berserk_frenzy'), ('unstoppable')) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name JOIN entity.species s ON s.species_name = 'bear'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_roar','Roar'), ('move_name_rear_up','Rear Up'), ('move_name_swat','Swat'), ('move_name_rend','Rend'), ('move_name_crunch','Crunch'), ('move_name_chomp','Chomp'), ('move_name_bear_hug','Bear Hug'), ('move_name_thick_fur','Thick Fur'), ('move_name_terrifying_roar','Terrifying Roar'), ('move_name_savage_maul','Savage Maul'), ('move_name_bone_crusher','Bone Crusher'), ('move_name_crushing_hug','Crushing Hug'), ('move_name_ground_slam','Ground Slam'), ('move_name_lick_wounds','Lick Wounds'), ('move_name_berserk_frenzy','Berserk Frenzy'), ('move_name_unstoppable','Unstoppable')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
