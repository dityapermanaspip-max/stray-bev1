import type pg from 'pg';

// Admin entity list: one row per entity, filtered by kind and a name search.

export const ENTITY_KINDS = ['player', 'native', 'named', 'boss', 'recruit', 'summoner'] as const;

export type EntityRow = {
  id: string;
  kind: string;
  name: string;
  alive: boolean;
  race: string | null;
  species: string | null;
  location: string | null;
  moves: number;
};

export async function listEntities(pool: pg.Pool, kind: string, q: string): Promise<EntityRow[]> {
  const res = await pool.query<EntityRow>(
    `SELECT e.id, e.kind, e.name, e.alive, r.race_name AS race, s.species_name AS species, e.location_ref AS location,
            (SELECT count(*)::int FROM entity.known_moves k WHERE k.entity_id = e.id) AS moves
     FROM entity.entities e
     LEFT JOIN entity.races r ON r.id = e.race_id
     LEFT JOIN entity.species s ON s.id = e.species_id
     WHERE ($1 = '' OR e.kind = $1) AND ($2 = '' OR e.name ILIKE '%' || $2 || '%')
     ORDER BY e.kind, e.name
     LIMIT 200`,
    [kind, q],
  );
  return res.rows;
}
