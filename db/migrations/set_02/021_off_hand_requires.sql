-- Dual moves need a weapon type in the off hand too (off_hand_type).
ALTER TABLE moves.move_requires DROP CONSTRAINT IF EXISTS move_requires_kind_check;
ALTER TABLE moves.move_requires ADD CONSTRAINT move_requires_kind_check
  CHECK (kind IN ('weapon_type','off_hand_type','body_part','ammo_type','stat_min','affinity'));
