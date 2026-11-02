-- Recruits (docs/WORLD.md, Recruit pool). A template is a role (mercenary, bard, apprentice healer, a notable's
-- heir...): fixed stats, its move pool, gear, life skills and where it waits. Rolled recruits are ordinary entities
-- (kind recruit or summoner); world.town_recruits says where each waits and how it can be had. All hidden.
CREATE TABLE entity.recruit_templates (
  template_name text PRIMARY KEY,
  data jsonb NOT NULL
);

CREATE TABLE world.town_recruits (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  town_ref text NOT NULL, -- world.towns id as text
  template text NOT NULL REFERENCES entity.recruit_templates(template_name),
  source text NOT NULL CHECK (source IN ('pool','lineage','summoner')),
  spot text NOT NULL, -- inn, training_ground, street, node, or the parent's door / notable role
  parent_id uuid REFERENCES entity.entities(id) ON DELETE SET NULL, -- lineage: the keeper or notable offering them
  bound_to uuid REFERENCES entity.entities(id) ON DELETE CASCADE, -- summoner: the player it summoned
  wage_per_day integer CHECK (wage_per_day >= 0), -- mercenary: copper per world day
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX town_recruits_town ON world.town_recruits (town_ref, source);
