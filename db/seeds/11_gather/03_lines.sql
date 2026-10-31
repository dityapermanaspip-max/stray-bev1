-- Names (exactly one line each) and the gathering sentences (at least 6 each).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('node_name_rock', 'Rock face'), ('node_name_tree', 'Old tree'), ('node_name_herb', 'Herb patch'), ('node_name_fish', 'Fishing spot'),
  ('move_name_mining', 'Mining'), ('move_name_woodcutting', 'Woodcutting'), ('move_name_herbalism', 'Herbalism'), ('move_name_fishing', 'Fishing'),
  ('item_name_hatchet', 'Hatchet'), ('item_name_pickaxe', 'Pickaxe'), ('item_name_fishing_rod', 'Fishing rod'),
  ('item_name_flint', 'Flint'), ('item_name_copper_ore', 'Copper ore'), ('item_name_iron_ore', 'Iron ore'),
  ('item_name_heartwood', 'Heartwood'), ('item_name_wild_herb', 'Wild herb'), ('item_name_bitterleaf', 'Bitterleaf'),
  ('item_name_gloomcap', 'Gloomcap'), ('item_name_small_fish', 'Small fish'), ('item_name_trout', 'Trout')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('ask.node', 'neutral', 'There might be something worth taking here.'),
  ('ask.node', 'neutral', 'Worth a try, while I am here?'),
  ('ask.node', 'neutral', 'I could work this for a while.'),
  ('ask.node', 'neutral', 'A little effort here could pay.'),
  ('ask.node', 'neutral', 'Shall I see what this gives?'),
  ('ask.node', 'neutral', 'My hands itch to work this.'),
  ('ask.node_dark', 'tense', 'It looks blighted, and something feels close. Still want it?'),
  ('ask.node_dark', 'tense', 'Black veins run through it. Whatever spoiled it may be near.'),
  ('ask.node_dark', 'tense', 'It smells wrong here. The good stuff tends to grow where danger does.'),
  ('ask.node_dark', 'tense', 'Something has touched this. I would not linger.'),
  ('ask.node_dark', 'tense', 'Darkened, but richer for it. Do I dare?'),
  ('ask.node_dark', 'tense', 'I feel watched. Work it quickly, or leave it?'),
  ('gather.found', 'pleased', 'Not bad for a bit of work.'),
  ('gather.found', 'pleased', 'Something to carry home.'),
  ('gather.found', 'pleased', 'That was worth stopping for.'),
  ('gather.found', 'pleased', 'My hands know a little more about this now.'),
  ('gather.found', 'pleased', 'A modest haul, but mine.'),
  ('gather.found', 'pleased', 'Every bit helps.'),
  ('gather.nothing', 'sad', 'Nothing worth keeping this time.'),
  ('gather.nothing', 'sad', 'All that effort for nothing.'),
  ('gather.nothing', 'sad', 'Empty hands. Maybe next time.'),
  ('gather.nothing', 'sad', 'It gave me nothing. I gave it sweat.'),
  ('gather.nothing', 'sad', 'Not today, it seems.'),
  ('gather.nothing', 'sad', 'I come away with dirt and little else.'),
  ('gather.empty', 'neutral', 'Someone has worked this bare. It needs time.'),
  ('gather.empty', 'neutral', 'There is nothing left to take for now.'),
  ('gather.empty', 'neutral', 'Spent. I should come back later.'),
  ('gather.empty', 'neutral', 'Picked clean. It will recover, given time.'),
  ('gather.empty', 'neutral', 'Nothing left here. Others were quicker.'),
  ('gather.empty', 'neutral', 'It has given all it has, for now.'),
  ('gather.no_tool', 'confused', 'I have nothing to work this with.'),
  ('gather.no_tool', 'confused', 'Bare hands will not do here. I need a tool.'),
  ('gather.no_tool', 'confused', 'Without the right tool, I would only hurt myself.'),
  ('gather.no_tool', 'confused', 'I would need something fit for the job.'),
  ('gather.no_tool', 'confused', 'Nothing in my bag is right for this.'),
  ('gather.no_tool', 'confused', 'I look at it, then at my empty hands.'),
  ('gather.learned', 'surprised', 'Oh. I think I am getting the hang of this.'),
  ('gather.learned', 'surprised', 'So this is how it is done. I will remember.'),
  ('gather.learned', 'surprised', 'A new kind of work. My hands start to learn it.'),
  ('gather.learned', 'surprised', 'Clumsy, but I understand it now.'),
  ('gather.learned', 'surprised', 'There is a knack to this. I found it.'),
  ('gather.learned', 'surprised', 'I could get good at this, given time.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
