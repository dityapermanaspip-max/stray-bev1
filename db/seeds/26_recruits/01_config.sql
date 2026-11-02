-- Recruits (docs/WORLD.md, Recruit pool). All hidden: shares, thresholds, wages never reach the client.
--   pool_share: outer ring share of the people living in a town, one step less per ring inward, never below min.
--   budget_spread: a recruit's move budget is the ring's creature budget +- this.
--   notables: every town has a village elder and a chief guard; bigger towns also a merchant and a mayor.
--   threshold: favor + charm + fame needed = (base + per_level x total move levels), x lineage_mult for a lineage
--   offer (a keeper's heir or pupil). inherit_share: a lineage recruit starts with up to this share of the player's
--   favor with the parent. wage: a mercenary's copper per world day = base + per_level x total move levels.
--   summoner_from: notable roles a summoner descends from.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('recruit', '{
  "pool_share": {"outer": 0.05, "step": 0.01, "min": 0.01},
  "budget_spread": 10,
  "notables": [
    {"role": "village_elder", "min_population": 0},
    {"role": "chief_guard", "min_population": 0},
    {"role": "merchant", "min_population": 600},
    {"role": "mayor", "min_population": 1200}
  ],
  "threshold": {"base": 10, "per_level": 1, "lineage_mult": 2},
  "inherit_share": 0.5,
  "wage": {"base": 5, "per_level": 0.5},
  "summoner_from": ["village_elder", "chief_guard", "merchant", "mayor"]
}', 'Recruit pool share by ring, move budget spread, notables by town size, recruit threshold, lineage inheritance, mercenary wage, summoner origins.')
ON CONFLICT (config_key) DO NOTHING;

-- Given names for rolled recruits (adults; any of them fits anyone).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'npc_name', 0, s.id, 'neutral', x.text
FROM (VALUES
  ('Arlen'), ('Bree'), ('Cato'), ('Dara'), ('Edrin'), ('Fenna'), ('Galen'), ('Hesta'), ('Ivo'), ('Jora'),
  ('Kellan'), ('Lirra'), ('Maren'), ('Nessa'), ('Orrin'), ('Pella'), ('Quill'), ('Rhosyn'), ('Soren'), ('Tamsin'),
  ('Ulric'), ('Vela'), ('Wren'), ('Yara'), ('Zeph'), ('Alda'), ('Brannoc'), ('Corra'), ('Dunstan'), ('Elsbet'),
  ('Fintan'), ('Greer'), ('Hollis'), ('Isolde'), ('Jasper'), ('Kestrel'), ('Linnet'), ('Morrow'), ('Nyle'), ('Oriel')
) AS x(text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
