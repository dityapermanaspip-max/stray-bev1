-- Luck (Step 1.9): every chance table is out of 1000, so luck can add flat per-mille.

ALTER TABLE item.loot_entries ADD COLUMN chance_permille integer;
UPDATE item.loot_entries SET chance_permille = round(chance * 1000);
ALTER TABLE item.loot_entries ALTER COLUMN chance_permille SET NOT NULL;
ALTER TABLE item.loot_entries ADD CONSTRAINT loot_entries_permille_check CHECK (chance_permille BETWEEN 1 AND 1000);
ALTER TABLE item.loot_entries DROP COLUMN chance;
