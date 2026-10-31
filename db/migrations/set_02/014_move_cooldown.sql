-- Optional per-move cooldown in seconds (stances, finishers). NULL = no cooldown.
ALTER TABLE moves.moves
  ADD COLUMN IF NOT EXISTS cooldown_seconds numeric CHECK (cooldown_seconds IS NULL OR cooldown_seconds >= 0);
