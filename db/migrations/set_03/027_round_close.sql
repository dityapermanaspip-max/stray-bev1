-- Round end: when the boss first falls the round gets closes_at (now + config round.closing_hours, real hours). The
-- world stays open until then; the game server then marks it ended. A new world is started by hand (world:new),
-- since several worlds may run at once on their own schedules.
ALTER TABLE world.rounds ADD COLUMN closes_at timestamptz;
