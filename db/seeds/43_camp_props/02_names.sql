-- The camp's rest is now the bed, so its panel is the bedroll; the campfire opens the cook's panel.
UPDATE presentation.diegetic_lines SET text = 'Bedroll' WHERE condition_key = 'service_name_camp';
