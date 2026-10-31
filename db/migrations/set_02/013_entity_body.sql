-- Current HP, stamina and mana outside battle. Maximums are derived, never stored.
-- No row means the body is full. Written at battle end, rest, potion use and waking up.
CREATE TABLE entity.entity_body (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  hp numeric NOT NULL CHECK (hp >= 0),
  stamina numeric NOT NULL CHECK (stamina >= 0),
  mana numeric NOT NULL CHECK (mana >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
