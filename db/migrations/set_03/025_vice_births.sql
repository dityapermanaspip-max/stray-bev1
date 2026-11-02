-- How each vice came to be (hidden): 'start' (world generation), 'rebirth' (last of its type died), 'invasion'
-- (born in the hex an invasion left). The boss grows from every vice not born at the start. Invasions also keep the
-- world hour they happened in.
ALTER TABLE world.vice_state
  ADD COLUMN born text NOT NULL DEFAULT 'start' CHECK (born IN ('start', 'rebirth', 'invasion')),
  ADD COLUMN born_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE world.invasions
  ADD COLUMN world_hour integer;

CREATE INDEX IF NOT EXISTS invasions_round_idx ON world.invasions (round_id, started_at);
