-- Cats gain a voice and a tail, and their pool becomes the whole feline tree. Display names for the new moves.

UPDATE entity.species
SET body_parts = (SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(body_parts || ARRAY['voice','tail']) AS p)
WHERE species_name = 'cat' AND NOT (body_parts @> ARRAY['voice','tail']);

INSERT INTO entity.species_moves (species_id, move_id)
SELECT s.id, m.id
FROM (VALUES
  ('scratch'), ('bite'), ('pounce'), ('crouch'), ('hiss'),
  ('claw_swipe'), ('hook_claw'), ('quick_nip'), ('scruff_bite'), ('ambush_leap'), ('slip_away'), ('cat_nap'),
  ('yowl'), ('tail_twitch'),
  ('shred'), ('blinding_swipe'), ('throat_bite'), ('pin_down'), ('land_on_feet'), ('glare'), ('caterwaul'),
  ('ribbon_slash'), ('death_grip'), ('shadow_pounce')
) AS x(move_name)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN entity.species s ON s.species_name = 'cat'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('crouch', 'Crouch'), ('hiss', 'Hiss'), ('claw_swipe', 'Claw Swipe'), ('hook_claw', 'Hook Claw'),
  ('quick_nip', 'Quick Nip'), ('scruff_bite', 'Scruff Bite'), ('ambush_leap', 'Ambush Leap'), ('slip_away', 'Slip Away'),
  ('cat_nap', 'Cat Nap'), ('yowl', 'Yowl'), ('tail_twitch', 'Tail Twitch'), ('shred', 'Shred'),
  ('blinding_swipe', 'Blinding Swipe'), ('throat_bite', 'Throat Bite'), ('pin_down', 'Pin Down'),
  ('land_on_feet', 'Land on Feet'), ('glare', 'Glare'), ('caterwaul', 'Caterwaul'),
  ('ribbon_slash', 'Ribbon Slash'), ('death_grip', 'Death Grip'), ('shadow_pounce', 'Shadow Pounce')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
