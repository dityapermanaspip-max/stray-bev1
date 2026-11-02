-- Town cultures (docs/WORLD.md, Races and cultures). Each culture has its own town field: the square's layout
-- with its own doors. Dwarf holds have a blacksmith; elven groves an herbalist and no cook (elves eat no meat).
INSERT INTO world.field_templates (template_name, kind, width, height, params)
SELECT x.name, t.kind, t.width, t.height, jsonb_set(t.params, '{town,buildings}', x.buildings::jsonb)
FROM (VALUES
  ('dwarf_hold', '[{"service":"inn","w":4,"h":3},{"service":"shop","w":3,"h":3},{"service":"blacksmith","w":3,"h":3},
    {"service":"cook","w":3,"h":3},{"service":"temple","w":3,"h":3},{"service":"guild","w":3,"h":3},{"service":"trainer","w":3,"h":3}]'),
  ('elf_grove', '[{"service":"inn","w":4,"h":3},{"service":"shop","w":3,"h":3},{"service":"herbalist","w":3,"h":3},
    {"service":"woodworker","w":3,"h":3},{"service":"temple","w":3,"h":3},{"service":"guild","w":3,"h":3},{"service":"trainer","w":3,"h":3}]')
) AS x(name, buildings)
JOIN world.field_templates t ON t.template_name = 'town_square'
ON CONFLICT (template_name) DO NOTHING;

-- data: specialties (goods families on top of the biome's), taboo (item types, shapes or goods families its shops
-- refuse), jobs (job shares; miners and herbalists are common jobs for now: no store goods yet), pool_weights
-- (template weight multipliers for its own folk; 0 = never), visitor_share (recruits of another race).
INSERT INTO world.cultures (culture_name, race_id, town_template, biomes, position, data)
SELECT x.name, r.id, x.template, x.biomes, x.position, x.data::jsonb
FROM (VALUES
  ('human', 'human', 'town_square', ARRAY['meadow','seashore','desert','battlefield'], 1,
   '{"visitor_share":0.1}'),
  ('dwarf', 'dwarf', 'dwarf_hold', ARRAY['volcano','snow'], 2,
   '{"visitor_share":0.1,
     "jobs":{"miner":0.30,"blacksmith":0.08,"hunter":0.20,"guard":0.10,"cook":0.07,"laborer":0.05,"woodcutter":0.08,"tanner":0.05,"farmer":0.07},
     "pool_weights":{"dwarf_miner":3,"dwarf_axeman":2,"herb_gatherer":0.5}}'),
  ('elf', 'elf', 'elf_grove', ARRAY['grove'], 3,
   '{"visitor_share":0.1,"taboo":["meat","carcass"],
     "jobs":{"herbalist":0.30,"farmer":0.25,"woodcutter":0.15,"woodworker":0.10,"guard":0.10,"laborer":0.05,"hunter":0.05},
     "pool_weights":{"elf_herb_gatherer":3,"elf_ranger":2}}')
) AS x(name, race, template, biomes, position, data)
JOIN entity.races r ON r.race_name = x.race
ON CONFLICT (culture_name) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'service_name_' || x.service, 0, s.id, 'neutral', x.text
FROM (VALUES ('blacksmith', 'Blacksmith'), ('herbalist', 'Herbalist')) AS x(service, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
