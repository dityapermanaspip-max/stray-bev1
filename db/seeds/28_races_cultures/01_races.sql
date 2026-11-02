-- Races of the world (docs/WORLD.md, Races and cultures). The Summoned stay human (they come from Earth); dwarves
-- and elves are born here. stat_mods add to a recruit template's stats. Resistances and race_exp are hidden.
-- First guesses, tune later.
INSERT INTO entity.races (race_name, body_parts, stat_mods, size) VALUES
('dwarf', ARRAY['hands','feet','body'], '{"str":1,"end":2,"dex":-1,"luck":-1,"charm":-1}', 'medium'),
('elf',   ARRAY['hands','feet','body'], '{"dex":2,"int":1,"str":-1,"end":-2}', 'medium')
ON CONFLICT (race_name) DO NOTHING;

-- Dwarves: forge-born, hard to burn or poison. Elves: of the wind and the green, wary of the dark.
INSERT INTO entity.resistances (owner_kind, owner_id, target_kind, target_id, mult)
SELECT 'race', r.id, x.kind, x.target, x.mult
FROM (VALUES
  ('dwarf', 'element', 'fire', 0.75), ('dwarf', 'element', 'earth', 0.85), ('dwarf', 'status', 'poison', 0.8),
  ('dwarf', 'element', 'water', 1.15),
  ('elf', 'element', 'wind', 0.8), ('elf', 'status', 'poison', 0.75), ('elf', 'element', 'dark', 1.25)
) AS x(race, kind, target, mult)
JOIN entity.races r ON r.race_name = x.race
ON CONFLICT (owner_kind, owner_id, target_kind, target_id) DO NOTHING;

-- Hidden move exp by race: dwarves take to heavy moves, elves to quick ones and the bow.
UPDATE config.balance_config SET value = value || '{
  "dwarf": [{"tags": ["growth.heavy"], "mult": 1.1}],
  "elf": [{"tags": ["growth.quick", "tree:bow"], "mult": 1.1}]
}'::jsonb
WHERE config_key = 'growth.race_exp';

-- Given names by race (npc_name.<race>); humans keep the shared npc_name pool. Adults, any of them fits anyone.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'npc_name.' || x.race, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('dwarf', 'Brokk'), ('dwarf', 'Dagna'), ('dwarf', 'Thrain'), ('dwarf', 'Helga'), ('dwarf', 'Borin'), ('dwarf', 'Kildra'),
  ('dwarf', 'Grundi'), ('dwarf', 'Asta'), ('dwarf', 'Durk'), ('dwarf', 'Runa'), ('dwarf', 'Faldor'), ('dwarf', 'Sigrun'),
  ('dwarf', 'Hrolf'), ('dwarf', 'Ingra'), ('dwarf', 'Ketil'), ('dwarf', 'Mardis'), ('dwarf', 'Orrin'), ('dwarf', 'Tova'),
  ('dwarf', 'Varek'), ('dwarf', 'Yrsa'),
  ('elf', 'Aelar'), ('elf', 'Sylwen'), ('elf', 'Thalion'), ('elf', 'Miriel'), ('elf', 'Caelum'), ('elf', 'Ilyra'),
  ('elf', 'Faenor'), ('elf', 'Liria'), ('elf', 'Erevan'), ('elf', 'Naeris'), ('elf', 'Galinor'), ('elf', 'Talindra'),
  ('elf', 'Ithil'), ('elf', 'Velanna'), ('elf', 'Aerith'), ('elf', 'Lorien'), ('elf', 'Quilla'), ('elf', 'Saelis'),
  ('elf', 'Varis'), ('elf', 'Ysolde')
) AS x(race, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
