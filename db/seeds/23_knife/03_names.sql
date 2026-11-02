-- Display names for the knife moves.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_flick_stab','Flick Stab'), ('move_name_lunge','Lunge'), ('move_name_puncture','Puncture'), ('move_name_heartseeker','Heartseeker'), ('move_name_slice','Slice'), ('move_name_hamstring','Hamstring'), ('move_name_flay','Flay'), ('move_name_fan_slash','Fan Slash'), ('move_name_tendon_cut','Tendon Cut'), ('move_name_joint_cut','Joint Cut'), ('move_name_cleave','Cleave'), ('move_name_butchers_eye','Butcher''s Eye'), ('move_name_carve','Carve'), ('move_name_feint','Feint'), ('move_name_dirty_trick','Dirty Trick'), ('move_name_backstab','Backstab'), ('move_name_throat_slit','Throat Slit'), ('move_name_knife_parry','Knife Parry'), ('move_name_reverse_grip','Reverse Grip'), ('move_name_riposte','Riposte')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
