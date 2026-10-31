-- Item names (exactly one line each), equip and unequip lines by slot kind, and load tier lines.

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'item_name_' || x.item_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('iron_knife','Iron knife'), ('oak_club','Oak club'), ('iron_hammer','Iron hammer'), ('iron_sword','Iron sword'),
  ('river_stone','River stone'), ('oak_stick','Oak stick'),
  ('frying_pan','Frying pan'), ('letter_opener','Letter opener'), ('pocket_knife','Pocket knife'),
  ('backpack','Backpack'), ('water_bottle','Water bottle'), ('blanket','Blanket'),
  ('leather_cap','Leather cap'), ('leather_jerkin','Leather jerkin'), ('leather_gloves','Leather gloves'),
  ('leather_trousers','Leather trousers'), ('leather_boots','Leather boots'),
  ('iron_helm','Iron helm'), ('iron_cuirass','Iron cuirass'), ('iron_gauntlets','Iron gauntlets'),
  ('iron_greaves','Iron greaves'), ('iron_boots','Iron boots'),
  ('copper_ring','Copper ring')
) AS x(item_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('gear.equip.wield', 'I close my hand around it and test the grip.'),
  ('gear.equip.wield', 'It sits in my hand like it belongs there.'),
  ('gear.equip.wield', 'I give it a practice swing.'),
  ('gear.equip.wield', 'I weigh it in my palm and hold on.'),
  ('gear.equip.wield', 'Ready in hand.'),
  ('gear.equip.wield', 'I take it up and get a feel for it.'),
  ('gear.unequip.wield', 'I let go of it and stow it away.'),
  ('gear.unequip.wield', 'My hand is empty again.'),
  ('gear.unequip.wield', 'I put it away for now.'),
  ('gear.unequip.wield', 'I loosen my grip and set it aside.'),
  ('gear.unequip.wield', 'Back in the bag it goes.'),
  ('gear.unequip.wield', 'I flex my fingers, free again.'),
  ('gear.equip.wear', 'I pull it on and tighten the straps.'),
  ('gear.equip.wear', 'It settles onto me, snug enough.'),
  ('gear.equip.wear', 'I strap it on and roll my shoulders.'),
  ('gear.equip.wear', 'A little stiff, but it fits.'),
  ('gear.equip.wear', 'I put it on and move around to test it.'),
  ('gear.equip.wear', 'It feels safer with this on.'),
  ('gear.unequip.wear', 'I take it off and breathe a little easier.'),
  ('gear.unequip.wear', 'I unbuckle it and fold it away.'),
  ('gear.unequip.wear', 'It comes off with a tug.'),
  ('gear.unequip.wear', 'I feel lighter, and a little exposed.'),
  ('gear.unequip.wear', 'I slip out of it.'),
  ('gear.unequip.wear', 'Off it comes, into the bag.'),
  ('gear.equip.adorn', 'I put it on and turn it to catch the light.'),
  ('gear.equip.adorn', 'A small thing, but I like how it looks.'),
  ('gear.equip.adorn', 'It sits cool against my skin.'),
  ('gear.equip.adorn', 'I fasten it carefully.'),
  ('gear.equip.adorn', 'There, that suits me.'),
  ('gear.equip.adorn', 'I wear it and forget it is there.'),
  ('gear.unequip.adorn', 'I take it off and tuck it away.'),
  ('gear.unequip.adorn', 'I slip it off.'),
  ('gear.unequip.adorn', 'It comes off easily.'),
  ('gear.unequip.adorn', 'I put it somewhere safe.'),
  ('gear.unequip.adorn', 'Bare again.'),
  ('gear.unequip.adorn', 'I pocket it for later.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

-- load tiers: 1 light, 2 carrying a fair amount, 3 slowed, 4 cannot move.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'load', x.tier, s.id, x.expression, x.text
FROM (VALUES
  (1, 'neutral', 'My pack is light.'),
  (1, 'neutral', 'I barely notice what I carry.'),
  (1, 'neutral', 'Plenty of room for more.'),
  (1, 'neutral', 'I travel light.'),
  (1, 'neutral', 'Nothing weighs on me.'),
  (1, 'neutral', 'My load is easy.'),
  (2, 'neutral', 'My pack has some weight to it now.'),
  (2, 'neutral', 'I can feel what I carry, but it is fine.'),
  (2, 'neutral', 'A fair load on my back.'),
  (2, 'neutral', 'There is still room, though not much to spare.'),
  (2, 'neutral', 'The straps dig in a little.'),
  (2, 'neutral', 'I carry a decent amount.'),
  (3, 'pained', 'This load is slowing me down.'),
  (3, 'pained', 'My legs drag under all this weight.'),
  (3, 'pained', 'I am carrying too much to move freely.'),
  (3, 'pained', 'Every step feels heavier.'),
  (3, 'pained', 'My back aches from the pack.'),
  (3, 'pained', 'I should lighten my load.'),
  (4, 'pained', 'I cannot take a single step like this.'),
  (4, 'pained', 'The weight pins me where I stand.'),
  (4, 'pained', 'I have to drop something before I can move.'),
  (4, 'pained', 'Far too heavy, I am stuck.'),
  (4, 'pained', 'My legs refuse to carry all this.'),
  (4, 'pained', 'Nothing moves until something goes.')
) AS x(tier, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
