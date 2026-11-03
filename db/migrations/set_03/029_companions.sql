-- Companions: how an NPC sits in the party. A permanent recruit stays until dismissed; a mercenary is hired for
-- paid days (wage_per_day copper per world day) and leaves when paid_until passes. Hidden.
ALTER TABLE social.party_members
  ADD COLUMN bond text NOT NULL DEFAULT 'permanent' CHECK (bond IN ('permanent', 'mercenary')),
  ADD COLUMN wage_per_day integer CHECK (wage_per_day >= 0),
  ADD COLUMN paid_until timestamptz;
