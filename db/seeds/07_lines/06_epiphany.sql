-- Epiphany on a new move. Vague: never names the move, never a number.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'surprised', x.text
FROM (VALUES
  ('epiphany_mastery', 'Something clicks into place after all that practice.'),
  ('epiphany_mastery', 'My body just showed me something new.'),
  ('epiphany_mastery', 'All those repetitions have opened a door.'),
  ('epiphany_mastery', 'Wait, I think I could do that differently.'),
  ('epiphany_mastery', 'An idea surfaces from the ache in my muscles.'),
  ('epiphany_mastery', 'I feel a new motion waiting in my hands.'),
  ('epiphany_trainer', 'So that is what they meant.'),
  ('epiphany_trainer', 'The lesson finally sinks in.'),
  ('epiphany_trainer', 'I can see what they were showing me now.'),
  ('epiphany_trainer', 'Their words take shape in my body.'),
  ('epiphany_trainer', 'I think I understand the teaching at last.'),
  ('epiphany_trainer', 'Something they said keeps echoing, and now it makes sense.'),
  ('epiphany_scroll', 'The ink seems to crawl into my mind.'),
  ('epiphany_scroll', 'The words on the page rearrange themselves into sense.'),
  ('epiphany_scroll', 'I read it once and cannot forget it.'),
  ('epiphany_scroll', 'The scroll crumbles, but its lesson stays with me.'),
  ('epiphany_scroll', 'A strange knowledge settles behind my eyes.'),
  ('epiphany_scroll', 'I understand something I never studied.'),
  ('epiphany_combo', 'Two things I know just fused into something else.'),
  ('epiphany_combo', 'What if I put those together?'),
  ('epiphany_combo', 'Separate habits suddenly fit like puzzle pieces.'),
  ('epiphany_combo', 'Two paths I walked meet somewhere new.'),
  ('epiphany_combo', 'I feel old lessons braiding into one.'),
  ('epiphany_combo', 'Everything I learned is starting to connect.'),
  ('epiphany_weapon', 'This weapon is already telling me how it wants to move.'),
  ('epiphany_weapon', 'My hands learn the weight of it at once.'),
  ('epiphany_weapon', 'I can feel what this tool was made for.'),
  ('epiphany_weapon', 'The grip settles and an idea comes with it.'),
  ('epiphany_weapon', 'It feels like I have held this before.'),
  ('epiphany_weapon', 'The weapon and I come to an understanding.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
