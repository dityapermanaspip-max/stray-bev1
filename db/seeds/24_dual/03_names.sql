-- Display names for the dual knife moves.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES ('move_name_twin_stab','Twin Stab'), ('move_name_cross_cut','Cross Cut'), ('move_name_offhand_feint','Off-hand Feint'), ('move_name_blade_guard','Blade Guard'), ('move_name_scissor_strike','Scissor Strike'), ('move_name_twin_riposte','Twin Riposte'), ('move_name_whirling_blades','Whirling Blades'), ('move_name_flurry_of_steel','Flurry of Steel'), ('move_name_dancing_steel','Dancing Steel'), ('move_name_twin_cleave','Twin Cleave'), ('move_name_thousand_cuts','Thousand Cuts'), ('move_name_crimson_waltz','Crimson Waltz')) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
