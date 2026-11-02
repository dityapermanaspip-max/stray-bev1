-- Battle formation: a fighter's place is a slot (front slots first, then back; config battle.formation). The row is
-- worked out from the slot and no longer stored.
ALTER TABLE entity.entities ADD COLUMN slot smallint NOT NULL DEFAULT 1 CHECK (slot >= 1);
UPDATE entity.entities SET slot = 5 WHERE row = 'back';
ALTER TABLE entity.entities DROP COLUMN row;
ALTER TABLE battle.battle_entities ADD COLUMN slot smallint NOT NULL DEFAULT 1 CHECK (slot >= 1);
UPDATE battle.battle_entities SET slot = 5 WHERE row = 'back';
ALTER TABLE battle.battle_entities DROP COLUMN row;
