-- Arrival questions. Effects are hidden; text is one line per key in diegetic_lines.
-- Item names are placeholders until the item step seeds them. Element names are placeholders.
UPDATE config.balance_config
SET value = value || '{"answers_per_question":5}', updated_at = now()
WHERE config_key = 'arrival';

INSERT INTO config.arrival_answers (question_key, question_position, answer_key, answer_position, effects) VALUES
('where', 1, 'kitchen', 1, '{"items":[{"item":"frying_pan","qty":1}],"clothing":"apron"}'),
('where', 1, 'office',  2, '{"items":[{"item":"letter_opener","qty":1}],"clothing":"office_wear"}'),
('where', 1, 'trail',   3, '{"items":[{"item":"pocket_knife","qty":1},{"item":"backpack","qty":1}],"clothing":"hiking_gear"}'),
('where', 1, 'gym',     4, '{"items":[{"item":"water_bottle","qty":1}],"clothing":"sportswear"}'),
('where', 1, 'bed',     5, '{"items":[{"item":"blanket","qty":1}],"clothing":"sleepwear"}'),
('hand', 2, 'first_aid', 1, '{"items":[{"item":"bandage","qty":3}]}'),
('hand', 2, 'lighter',   2, '{"items":[{"item":"lighter","qty":1}],"affinity_lean":{"fire":1}}'),
('hand', 2, 'umbrella',  3, '{"items":[{"item":"umbrella","qty":1}]}'),
('hand', 2, 'snack',     4, '{"items":[{"item":"snack_bar","qty":2}]}'),
('hand', 2, 'coins',     5, '{"items":[{"item":"foreign_coins","qty":5}],"summoned_nudge":0.02}'),
('call', 3, 'answer',    1, '{"summoned_nudge":0.08}'),
('call', 3, 'silent',    2, '{"summoned_nudge":-0.05}'),
('call', 3, 'other',     3, '{"summoned_nudge":0.03,"affinity_lean":{"air":1}}'),
('call', 3, 'cover',     4, '{"summoned_nudge":-0.08}'),
('call', 3, 'follow',    5, '{"summoned_nudge":0.05}'),
('smell', 4, 'smoke',   1, '{"affinity_lean":{"fire":2}}'),
('smell', 4, 'rain',    2, '{"affinity_lean":{"water":2}}'),
('smell', 4, 'frost',   3, '{"affinity_lean":{"ice":2}}'),
('smell', 4, 'iron',    4, '{"affinity_lean":{"earth":2}}'),
('smell', 4, 'flowers', 5, '{"affinity_lean":{"air":2}}'),
('door', 5, 'red',       1, '{"region":"ne"}'),
('door', 5, 'driftwood', 2, '{"region":"e"}'),
('door', 5, 'handleless',3, '{"region":"se","summoned_nudge":-0.02}'),
('door', 5, 'moss',      4, '{"region":"sw"}'),
('door', 5, 'open',      5, '{"region":"w","summoned_nudge":0.02}'),
('companion', 6, 'returns', 1, '{"personality":"tsundere"}'),
('companion', 6, 'listens', 2, '{"personality":"shy"}'),
('companion', 6, 'rushes',  3, '{"personality":"brave"}'),
('companion', 6, 'counts',  4, '{"personality":"greedy"}'),
('companion', 6, 'laughs',  5, '{"personality":"cheerful"}')
ON CONFLICT (question_key, answer_key) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('arrival.q.where', 'Where were you when the light found you?'),
  ('arrival.a.where.kitchen', 'Standing at the stove, something sizzling in the pan.'),
  ('arrival.a.where.office', 'At my desk, buried under paper.'),
  ('arrival.a.where.trail', 'Halfway up a mountain trail.'),
  ('arrival.a.where.gym', 'Between sets, out of breath.'),
  ('arrival.a.where.bed', 'Asleep, or nearly.'),
  ('arrival.q.hand', 'What is in your hand right now?'),
  ('arrival.a.hand.first_aid', 'A small box with a red cross on it.'),
  ('arrival.a.hand.lighter', 'A cheap lighter, still warm.'),
  ('arrival.a.hand.umbrella', 'An umbrella, folded tight.'),
  ('arrival.a.hand.snack', 'Something sweet I was saving for later.'),
  ('arrival.a.hand.coins', 'A fistful of loose change.'),
  ('arrival.q.call', 'Someone calls a name in the dark.'),
  ('arrival.a.call.answer', 'I answer, even if it is not mine.'),
  ('arrival.a.call.silent', 'I keep quiet and wait.'),
  ('arrival.a.call.other', 'I call back a different name.'),
  ('arrival.a.call.cover', 'I cover my ears.'),
  ('arrival.a.call.follow', 'I follow the voice without a word.'),
  ('arrival.q.smell', 'What does the dark smell like?'),
  ('arrival.a.smell.smoke', 'Smoke and embers.'),
  ('arrival.a.smell.rain', 'Rain on hot stone.'),
  ('arrival.a.smell.frost', 'Frost, sharp and clean.'),
  ('arrival.a.smell.iron', 'Iron and wet earth.'),
  ('arrival.a.smell.flowers', 'Flowers I cannot name.'),
  ('arrival.q.door', 'Doors open around you. Which do you walk through?'),
  ('arrival.a.door.red', 'The red one.'),
  ('arrival.a.door.driftwood', 'The one made of driftwood.'),
  ('arrival.a.door.handleless', 'The one with no handle.'),
  ('arrival.a.door.moss', 'The one covered in moss.'),
  ('arrival.a.door.open', 'The one already standing open.'),
  ('arrival.q.companion', 'Someone will share your fire one day. Which flaw could you forgive?'),
  ('arrival.a.companion.returns', 'They never say thank you, but they always come back.'),
  ('arrival.a.companion.listens', 'They barely speak, but they always listen.'),
  ('arrival.a.companion.rushes', 'They run in before thinking.'),
  ('arrival.a.companion.counts', 'They count every coin twice.'),
  ('arrival.a.companion.laughs', 'They laugh at the worst possible moment.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
