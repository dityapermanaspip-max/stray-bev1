-- Loot names and sentences: item names, carcass freshness, carrying, butcher and shop talk.

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('move_name_butchery', 'Butchery'),
  ('item_name_chicken_carcass', 'Chicken carcass'), ('item_name_lizard_carcass', 'Lizard carcass'),
  ('item_name_cat_carcass', 'Cat carcass'),
  ('item_name_chicken_meat', 'Chicken meat'), ('item_name_lizard_meat', 'Lizard meat'), ('item_name_cat_meat', 'Cat meat'),
  ('item_name_tainted_meat', 'Tainted meat'), ('item_name_rotten_meat', 'Rotten meat'),
  ('item_name_chicken_feather', 'Chicken feather'), ('item_name_blackened_feather', 'Blackened feather'),
  ('item_name_bone', 'Bone'), ('item_name_chicken_beak', 'Chicken beak'),
  ('item_name_lizard_scale', 'Lizard scale'), ('item_name_dull_scale', 'Dull scale'),
  ('item_name_lizard_tail', 'Lizard tail'), ('item_name_lizard_tooth', 'Lizard tooth'),
  ('item_name_cat_pelt', 'Cat pelt'), ('item_name_matted_pelt', 'Matted pelt'),
  ('item_name_cat_claw', 'Cat claw'), ('item_name_cat_whisker', 'Cat whisker'),
  ('item_name_essence', 'Essence'),
  ('item_name_copper_coin', 'Copper coin'), ('item_name_silver_coin', 'Silver coin'), ('item_name_gold_coin', 'Gold coin')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

-- carcass freshness: 1 fresh, 2 aging, 3 spoiling, 4 rotten.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'carcass.freshness', x.tier, s.id, 'neutral', x.text
FROM (VALUES
  (1, 'Still warm.'), (1, 'Freshly killed.'), (1, 'It has not even stiffened yet.'),
  (1, 'Clean and fresh.'), (1, 'The kill is recent.'), (1, 'No smell at all yet.'),
  (2, 'It has gone cold and stiff.'), (2, 'Not fresh, but still good.'), (2, 'A faint smell is starting.'),
  (2, 'It has been dead a while.'), (2, 'Better see a butcher soon.'), (2, 'Flies are starting to notice it.'),
  (3, 'The smell is getting strong.'), (3, 'It is starting to turn.'), (3, 'The flesh has gone soft and grey.'),
  (3, 'Flies circle it constantly.'), (3, 'Not much of this will be worth keeping.'), (3, 'I should have dealt with this sooner.'),
  (4, 'It reeks.'), (4, 'Rotten through.'), (4, 'Maggots have claimed it.'),
  (4, 'I can barely stand to carry it.'), (4, 'Nothing good is left in there.'), (4, 'It is more stench than meat now.')
) AS x(tier, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('loot.carcass.take', 'I heave the carcass onto my back.'),
  ('loot.carcass.take', 'Heavy, but it might be worth something in town.'),
  ('loot.carcass.take', 'I tie the body up and haul it along.'),
  ('loot.carcass.take', 'One more thing to carry.'),
  ('loot.carcass.take', 'I sling the carcass over my shoulder.'),
  ('loot.carcass.take', 'A butcher will know what to do with this.'),
  ('loot.carcass.left', 'There is no room to carry it, so it stays.'),
  ('loot.carcass.left', 'Too heavy to bring along.'),
  ('loot.carcass.left', 'I have to leave this one where it fell.'),
  ('loot.carcass.left', 'Nobody has the strength to carry another.'),
  ('loot.carcass.left', 'It will have to rot here.'),
  ('loot.carcass.left', 'I look at it, then at my pack, and give up.'),
  ('butcher.paid', 'The butcher takes the coins and gets to work.'),
  ('butcher.paid', 'A few quick cuts and it is done.'),
  ('butcher.paid', 'The butcher wipes the blade and slides the pieces over.'),
  ('butcher.paid', 'Coin first, then the cleaver comes down.'),
  ('butcher.paid', 'The butcher works fast and clean.'),
  ('butcher.paid', 'Paid and done, here is what was in it.'),
  ('butcher.cut', 'The butcher grins and keeps a share for the trouble.'),
  ('butcher.cut', 'No coin needed, the butcher takes a cut of the parts.'),
  ('butcher.cut', 'Some of the pieces end up on the butcher''s side of the counter.'),
  ('butcher.cut', 'A fair trade, the butcher says, picking the best bits.'),
  ('butcher.cut', 'The butcher pockets a few parts as payment.'),
  ('butcher.cut', 'I get what is left after the butcher takes a share.'),
  ('butcher.self', 'I open it up and get to work.'),
  ('butcher.self', 'Messy, but I manage.'),
  ('butcher.self', 'I cut along the joints the way I was shown.'),
  ('butcher.self', 'My hands are red to the wrist by the end.'),
  ('butcher.self', 'Slow work, but it is done.'),
  ('butcher.self', 'I separate what is useful from what is not.'),
  ('butcher.junk', 'Nothing in here worth a coin.'),
  ('butcher.junk', 'That was a lot of work for scraps.'),
  ('butcher.junk', 'Most of this is good for nothing.'),
  ('butcher.junk', 'Well, that was disappointing.'),
  ('butcher.junk', 'I doubt anyone would buy any of this.'),
  ('butcher.junk', 'Junk, all of it.'),
  ('butcher.cannot_pay', 'The butcher shakes their head at my empty purse.'),
  ('butcher.cannot_pay', 'No coin, no cutting.'),
  ('butcher.cannot_pay', 'I do not have enough to pay for this.'),
  ('butcher.cannot_pay', 'The butcher wants coin up front.'),
  ('butcher.cannot_pay', 'My purse is too light for the fee.'),
  ('butcher.cannot_pay', 'Come back when you can pay, says the butcher.'),
  ('butcher.no_tool', 'I need a blade for this.'),
  ('butcher.no_tool', 'Bare hands will not open a carcass.'),
  ('butcher.no_tool', 'Without a knife this is hopeless.'),
  ('butcher.no_tool', 'I have nothing sharp enough.'),
  ('butcher.no_tool', 'A knife would help, if I had one.'),
  ('butcher.no_tool', 'I cannot cut this without a proper blade.'),
  ('butcher.no_skill', 'I have no idea where to even start.'),
  ('butcher.no_skill', 'I would only make a mess of it.'),
  ('butcher.no_skill', 'Better leave this to someone who knows how.'),
  ('butcher.no_skill', 'I never learned how to do this.'),
  ('butcher.no_skill', 'A butcher would know what to do, I do not.'),
  ('butcher.no_skill', 'I stare at it and have no clue.'),
  ('butcher.bought', 'The butcher looks it over and pays a fair price.'),
  ('butcher.bought', 'Good enough, the butcher says, and counts out coins.'),
  ('butcher.bought', 'The butcher takes the whole carcass off my hands.'),
  ('butcher.bought', 'Coins for a carcass, simple as that.'),
  ('butcher.bought', 'The butcher hefts it and nods.'),
  ('butcher.bought', 'Sold, and my back thanks me.'),
  ('shop.bought', 'The shopkeeper wrinkles their nose but pays.'),
  ('shop.bought', 'Not much, but it is coin.'),
  ('shop.bought', 'The shopkeeper offers a low price, and I take it.'),
  ('shop.bought', 'A butcher would have paid more, I suspect.'),
  ('shop.bought', 'The shopkeeper drags it behind the counter.'),
  ('shop.bought', 'Sold, though not for much.'),
  ('shop.refuse_corrupted', 'The shopkeeper backs away from it.'),
  ('shop.refuse_corrupted', 'Get that tainted thing out of here.'),
  ('shop.refuse_corrupted', 'Nobody here wants something corrupted.'),
  ('shop.refuse_corrupted', 'The shopkeeper will not even touch it.'),
  ('shop.refuse_corrupted', 'Take it to a butcher, not to me.'),
  ('shop.refuse_corrupted', 'A sour look and a firm no.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
