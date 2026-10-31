-- Towns (Step 3). The last town a player entered: where they wake after passing out.
ALTER TABLE world.entity_positions ADD COLUMN wake_ref text; -- hex id as text; null = none yet
