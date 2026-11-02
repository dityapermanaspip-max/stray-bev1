-- A species born corrupted (e.g. the volcano chicken): world generation puts its whole head count in corrupted_count,
-- so every one met is corrupted. It never breeds (natives stay 0) and counts toward its hex's corruption.
ALTER TABLE entity.species ADD COLUMN IF NOT EXISTS born_corrupted boolean NOT NULL DEFAULT false;
