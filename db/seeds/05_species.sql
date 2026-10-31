-- Starting species. Fixed data, regular creatures never grow.
INSERT INTO entity.species (species_name, base_stats, body_parts, ring_min, ring_max, on_expiry)
VALUES
('chicken', '{"str":2,"dex":4,"int":1,"end":2,"luck":3,"charm":1}', ARRAY['beak','wings','feet'],          1, 4, 'ignore'),
('lizard',  '{"str":3,"dex":3,"int":1,"end":4,"luck":1,"charm":1}', ARRAY['teeth','tail','claws','feet'], 1, 4, 'devour'),
('cat',     '{"str":3,"dex":5,"int":2,"end":2,"luck":3,"charm":2}', ARRAY['claws','teeth','body','feet'], 1, 4, 'devour')
ON CONFLICT (species_name) DO NOTHING;

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('chicken', 'peck'), ('chicken', 'wing_flap'),
  ('lizard', 'bite'), ('lizard', 'tail_whip'),
  ('cat', 'scratch'), ('cat', 'bite'), ('cat', 'pounce')
) AS x(species_name, move_name)
JOIN entity.species s ON s.species_name = x.species_name
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT DO NOTHING;

-- Playable starting race for the Summoned.
INSERT INTO entity.races (race_name, body_parts, stat_mods, size)
VALUES ('human', ARRAY['hands','feet','body'], '{}', 'medium')
ON CONFLICT (race_name) DO NOTHING;
