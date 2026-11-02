-- The Dual Wielder trait: lets its holder carry a second weapon in the off hand. Rare: it costs most of a trait quota.
-- Code reads the modifier flag (dual_wield), never the trait name. Modifiers stay on the server.
INSERT INTO entity.traits (trait_name, modifiers, hidden, cost, weight)
VALUES ('dual_wielder', '{"dual_wield":true}', false, 80, 1)
ON CONFLICT (trait_name) DO NOTHING;

-- Refusal when someone without the trait tries to hold a second weapon.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'gear.no_dual_wield', 0, s.id, 'confused', x.text
FROM (VALUES
  ('My off hand fumbles it. One blade at a time for me.'),
  ('I cannot fight with a weapon in each hand.'),
  ('Two weapons at once? My hands will not work that way.'),
  ('I would only cut myself trying to swing both.'),
  ('My other hand has no feel for a second weapon.'),
  ('One weapon is all my hands can manage.')
) AS x(text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
