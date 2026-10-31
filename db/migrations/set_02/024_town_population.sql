-- Step 3d: a settlement's population is the base of its tick math. What villagers use from the store is per 100
-- people; the workforce is a config share of the population, spread over jobs by town_economy.jobs (job -> share).
ALTER TABLE world.town_economy ADD COLUMN population integer NOT NULL DEFAULT 0 CHECK (population >= 0);
COMMENT ON COLUMN world.town_economy.jobs IS 'job -> share of the workforce (hunter, woodcutter, cook, tanner, farmer, ...)';
