-- Display names for the weapon starters.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_greatsword_sweep','Sweep'), ('move_name_iai_cut','Iai Cut'), ('move_name_mace_bash','Mace Bash'), ('move_name_tonfa_strike','Tonfa Strike'), ('move_name_shield_bash','Shield Bash'), ('move_name_shield_block','Shield Block'), ('move_name_spear_thrust','Spear Thrust'), ('move_name_axe_chop','Axe Chop'), ('move_name_pick_swing','Pick Swing'), ('move_name_rod_whip','Rod Whip')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
