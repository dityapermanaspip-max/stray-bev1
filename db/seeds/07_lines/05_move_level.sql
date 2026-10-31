-- Move skill words. Tier 1 clumsy, 2 practiced, 3 skilled, 4 mastered. Spoken by the entity.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_level', x.tier, s.id, 'neutral', x.text
FROM (VALUES
  (1, 'I am still clumsy with this.'),
  (1, 'This feels awkward in my body.'),
  (1, 'I keep fumbling the motion.'),
  (1, 'I barely know what I am doing here.'),
  (1, 'It works, but only just.'),
  (1, 'My form is a mess.'),
  (2, 'I have practiced this enough to trust it.'),
  (2, 'The motion is starting to feel natural.'),
  (2, 'I rarely fumble this anymore.'),
  (2, 'My body remembers the shape of it.'),
  (2, 'It comes out cleaner each time.'),
  (2, 'I am getting the hang of this.'),
  (3, 'I am skilled at this now.'),
  (3, 'This flows out of me without effort.'),
  (3, 'I can do this half asleep.'),
  (3, 'Few could match me at this.'),
  (3, 'My form is clean and sharp.'),
  (3, 'I know every small trick of it.'),
  (4, 'I have mastered this completely.'),
  (4, 'There is nothing left for me to learn here.'),
  (4, 'This is part of who I am.'),
  (4, 'I could teach this in my sleep.'),
  (4, 'It is perfect every single time.'),
  (4, 'My body and this motion are one.')
) AS x(tier, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
