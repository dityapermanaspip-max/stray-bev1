-- Recruit templates by race (docs/WORLD.md, Recruit sources). races: who can be it (missing = anyone); the race's
-- stat_mods add to the stats. flag keys: a trait flag, 'element' (any element affinity) or '!element' (none).
-- Elves without an element take the bow (arrows in the bag); elemental elves a knife and palm moves until magic exists.
-- Gear slot 'bag': carried, not held.
UPDATE entity.recruit_templates t SET data = t.data || x.extra::jsonb
FROM (VALUES
  ('mercenary',         '{"races":["human"]}'),
  ('herb_gatherer',     '{"races":["human","dwarf"]}'),
  ('miner',             '{"races":["human"]}'),
  ('butcherson',        '{"races":["human","dwarf"]}'),
  ('cook_apprentice',   '{"races":["human","dwarf"]}'),
  ('tanner_apprentice', '{"races":["human","dwarf"]}'),
  ('woodcutter',        '{"open":["punch","kick","axe_chop"],"gear":[{"item":"hatchet","slot":"main_hand"}]}'),
  ('fisher',            '{"open":["punch","kick","basic_throw","rod_whip"],"gear":[{"item":"fishing_rod","slot":"main_hand"}]}'),
  ('guard_trainee',     '{"open":["punch","kick","sword_slash","guard","taunt","shield_block","shield_bash"],
                          "gear":[{"item":"iron_sword","slot":"main_hand"},{"item":"oak_shield","slot":"off_hand"}]}'),
  ('trainer_pupil',     '{"flag_moves":{"dual_wield":["tonfa_strike"]},"flag_gear":{"dual_wield":[{"item":"oak_tonfa","slot":"main_hand"}]}}')
) AS x(name, extra)
WHERE t.template_name = x.name;

INSERT INTO entity.recruit_templates (template_name, data)
SELECT x.name, x.data::jsonb FROM (VALUES
('dwarf_miner', '{"source":"pool","spot":"node","weight":2,"races":["dwarf"],
  "stats":{"str":7,"dex":4,"int":3,"end":7,"luck":4,"charm":3},
  "open":["punch","kick","pick_swing"], "moves":["heavy_strike","gut_punch","brace","hook"],
  "life":{"mining":[4,12]}, "gear":[{"item":"pickaxe","slot":"main_hand"}]}'),
('dwarf_axeman', '{"source":"pool","spot":"street","weight":3,"races":["dwarf"],"mercenary":true,
  "stats":{"str":7,"dex":5,"int":3,"end":7,"luck":4,"charm":3},
  "open":["punch","kick","axe_chop","basic_throw"], "moves":["axe_throw","heavy_strike","gut_punch","brace","low_kick","front_kick"],
  "gear":[{"item":"iron_war_axe","slot":"main_hand"}]}'),
('elf_ranger', '{"source":"pool","spot":"street","weight":3,"races":["elf"],"mercenary":true,
  "stats":{"str":5,"dex":7,"int":5,"end":5,"luck":5,"charm":4},
  "open":["punch","kick"], "moves":["dodge_step","front_kick","low_kick"],
  "flag_moves":{"!element":["shot","lucky_shot"],"element":["knife_stab","palm_strike","soft_palm","return_palm","pressure_jab"]},
  "flag_gear":{"!element":[{"item":"oak_bow","slot":"main_hand"},{"item":"oak_arrow","slot":"bag"}],
               "element":[{"item":"iron_knife","slot":"main_hand"}]}}'),
('elf_herb_gatherer', '{"source":"pool","spot":"node","weight":2,"races":["elf"],
  "stats":{"str":4,"dex":6,"int":5,"end":5,"luck":7,"charm":3},
  "open":["punch","kick"], "moves":["dodge_step","low_kick","front_kick"],
  "flag_moves":{"!element":["shot"],"element":["knife_stab","palm_strike","soft_palm"]},
  "flag_gear":{"!element":[{"item":"oak_bow","slot":"main_hand"},{"item":"oak_arrow","slot":"bag"},{"item":"iron_knife","slot":"bag"}],
               "element":[{"item":"iron_knife","slot":"main_hand"}]},
  "life":{"herbalism":[4,12],"scavenge":[1,6]}}'),
('herbalist_apprentice', '{"source":"lineage","parents":["herbalist"],"races":["elf","human"],
  "stats":{"str":3,"dex":6,"int":7,"end":5,"luck":6,"charm":4},
  "open":["punch","kick","knife_stab","bandage"], "moves":["slice","dodge_step","palm_strike","soft_palm"],
  "life":{"herbalism":[3,10]}, "gear":[{"item":"iron_knife","slot":"main_hand"}]}')
) AS x(name, data)
ON CONFLICT (template_name) DO UPDATE SET data = EXCLUDED.data;
