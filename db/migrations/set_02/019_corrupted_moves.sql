-- Corrupted-only pool moves: a creature rolls them only when it is corrupted (natives never know them).
ALTER TABLE entity.species_moves ADD COLUMN IF NOT EXISTS corrupted_only boolean NOT NULL DEFAULT false;
