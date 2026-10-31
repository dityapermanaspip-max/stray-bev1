-- Cross-schema foreign keys that could not exist before their target tables.

ALTER TABLE account.achievements
  ADD CONSTRAINT fk_achievements_round FOREIGN KEY (round_id) REFERENCES world.rounds(id);

ALTER TABLE world.hexes
  ADD CONSTRAINT fk_hexes_vice FOREIGN KEY (vice_entity_id) REFERENCES entity.entities(id);

ALTER TABLE world.field_population
  ADD CONSTRAINT fk_field_population_species FOREIGN KEY (species_id) REFERENCES entity.species(id);

ALTER TABLE world.corpses
  ADD CONSTRAINT fk_corpses_species FOREIGN KEY (species_id) REFERENCES entity.species(id);

ALTER TABLE world.vice_state
  ADD CONSTRAINT fk_vice_state_entity FOREIGN KEY (entity_id) REFERENCES entity.entities(id);

ALTER TABLE world.boss_state
  ADD CONSTRAINT fk_boss_state_entity FOREIGN KEY (entity_id) REFERENCES entity.entities(id);

ALTER TABLE world.invasions
  ADD CONSTRAINT fk_invasions_vice FOREIGN KEY (vice_entity_id) REFERENCES entity.entities(id);

ALTER TABLE world.invasion_contrib
  ADD CONSTRAINT fk_invasion_contrib_entity FOREIGN KEY (entity_id) REFERENCES entity.entities(id);

ALTER TABLE world.summoning_events
  ADD CONSTRAINT fk_summoning_summoner FOREIGN KEY (summoner_entity_id) REFERENCES entity.entities(id),
  ADD CONSTRAINT fk_summoning_player FOREIGN KEY (bound_player_entity_id) REFERENCES entity.entities(id);

ALTER TABLE entity.species
  ADD CONSTRAINT fk_species_loot_native FOREIGN KEY (loot_table_native) REFERENCES item.loot_tables(id),
  ADD CONSTRAINT fk_species_loot_corrupted FOREIGN KEY (loot_table_corrupted) REFERENCES item.loot_tables(id);

ALTER TABLE entity.entities
  ADD CONSTRAINT fk_entities_portrait FOREIGN KEY (portrait_id) REFERENCES presentation.portraits(id);

-- Indexes from DATABASE.md not already covered by unique constraints.
CREATE INDEX idx_borders_round_hex ON world.borders(round_id, hex_a);
CREATE INDEX idx_field_population_field ON world.field_population(field_ref);
CREATE INDEX idx_corpses_field ON world.corpses(field_ref);
