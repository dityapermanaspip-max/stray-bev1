-- Step 3d: the world clock and town workforce. A round counts the world hours that have run (tick_hours) and when
-- the last one was due (tick_at); the game server runs due hours (population rules, town ticks), capped catch-up.
ALTER TABLE world.rounds ADD COLUMN tick_hours bigint NOT NULL DEFAULT 0, ADD COLUMN tick_at timestamptz;

-- Each town's fixed workforce until recruits fill the jobs: job -> workers (hunter, woodcutter, cook, tanner, ...).
ALTER TABLE world.town_economy ADD COLUMN jobs jsonb NOT NULL DEFAULT '{}'::jsonb;
