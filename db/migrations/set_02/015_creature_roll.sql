-- Regular creatures are rolled per encounter (config creature.gen). A species names its 2 main stats, which roll in
-- the upper half of the ring's stat range. base_stats stays for reference and the admin lab.
ALTER TABLE entity.species ADD COLUMN main_stats text[] NOT NULL DEFAULT '{}';
