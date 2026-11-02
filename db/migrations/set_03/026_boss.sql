-- Boss entry and growth (hidden). A key spent at the boss chamber is kept with consumed_at set (never handed back,
-- unless the fight could not be opened at all). The boss counts the vices it has fed on (born after the start) and
-- remembers who defeated it.
ALTER TABLE item.keys ADD COLUMN consumed_at timestamptz;
CREATE INDEX IF NOT EXISTS keys_holder_idx ON item.keys (holder_entity_id) WHERE consumed_at IS NULL;

ALTER TABLE world.boss_state
  ADD COLUMN vices_fed integer NOT NULL DEFAULT 0 CHECK (vices_fed >= 0),
  ADD COLUMN defeated_at timestamptz,
  ADD COLUMN defeated_by uuid REFERENCES entity.entities(id);
