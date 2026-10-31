-- Town text (Step 3): service display names (one line each) and the sentences heard at the doors.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'service_name_' || x.service, 0, s.id, 'neutral', x.text
FROM (VALUES ('inn', 'Inn'), ('shop', 'Shop'), ('temple', 'Temple'), ('guild', 'Guild'), ('trainer', 'Trainer')) AS x(service, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('town.inn.rested', 'calm', 'A real bed. I wake up whole again.'),
  ('town.inn.rested', 'calm', 'I sleep like a stone and wake without a single ache.'),
  ('town.inn.rested', 'calm', 'A warm meal, a long night, and I feel new.'),
  ('town.inn.rested', 'calm', 'The innkeeper was right. That bed fixes anything.'),
  ('town.inn.rested', 'calm', 'I wake to morning light, rested and ready.'),
  ('town.inn.rested', 'calm', 'Every bruise has faded overnight.'),
  ('town.inn.no_money', 'embarrassed', 'My purse is too light for a room here.'),
  ('town.inn.no_money', 'embarrassed', 'I count my coins twice. Not enough.'),
  ('town.inn.no_money', 'embarrassed', 'The innkeeper shakes their head at my coins.'),
  ('town.inn.no_money', 'embarrassed', 'A bed costs more than I carry.'),
  ('town.inn.no_money', 'embarrassed', 'I will have to earn some coin first.'),
  ('town.inn.no_money', 'embarrassed', 'No room for someone with empty pockets.'),
  ('town.closed', 'neutral', 'The door is shut. Nobody answers.'),
  ('town.closed', 'neutral', 'A sign hangs on the door: come back later.'),
  ('town.closed', 'neutral', 'I knock, but the place is empty for now.'),
  ('town.closed', 'neutral', 'The windows are dark. Not open yet.'),
  ('town.closed', 'neutral', 'Locked. Someone will run this place one day.'),
  ('town.closed', 'neutral', 'Dust on the step. Nobody has been in for a while.'),
  ('town.shop.nothing', 'neutral', 'I have nothing the shopkeeper wants.'),
  ('town.shop.nothing', 'neutral', 'The shopkeeper looks at my bag and shrugs.'),
  ('town.shop.nothing', 'neutral', 'Nothing in my pack to trade today.'),
  ('town.shop.nothing', 'neutral', 'I have nothing worth selling right now.'),
  ('town.shop.nothing', 'neutral', 'My bag holds nothing for this counter.'),
  ('town.shop.nothing', 'neutral', 'Empty-handed at the shop again.'),
  ('loadout.not_here', 'strained', 'This is no place to change how I fight.'),
  ('loadout.not_here', 'strained', 'I need the safety of a town for that.'),
  ('loadout.not_here', 'strained', 'Out here I keep my hands as they are.'),
  ('loadout.not_here', 'strained', 'Not in the open. I will sort that out in town.'),
  ('loadout.not_here', 'strained', 'I cannot rethink my moves with danger this close.'),
  ('loadout.not_here', 'strained', 'That has to wait until I am behind town walls.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
