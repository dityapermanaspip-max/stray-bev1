-- Fog of war on the world map: the hexes a player has stood in. Their neighbors, and both ends of the corridor the
-- player is in, show as glimpsed (biome only); everything else stays fog.
CREATE TABLE world.known_hexes (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  hex_id uuid NOT NULL REFERENCES world.hexes(id) ON DELETE CASCADE,
  first_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, hex_id)
);
