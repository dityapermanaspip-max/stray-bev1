import type pg from 'pg';

// Admin entity sheet: raw rows for one entity. Admin only (hidden numbers are allowed here, never in the game client).

export type EntitySheet = {
  id: string;
  kind: string;
  name: string;
  alive: boolean;
  race: string | null;
  species: string | null;
  location: string | null;
  slot: number;
  fame: number;
  stats: { stat: string; base: number; exp: number }[];
  moves: { name: string; level: number; exp: number; slot: number | null }[];
  traits: string[];
  body: { hp: number; stamina: number; mana: number } | null;
};

export async function entitySheet(pool: pg.Pool, id: string): Promise<EntitySheet | null> {
  const head = await pool.query(
    `SELECT e.id, e.kind, e.name, e.alive, e.location_ref, e.slot, e.fame, r.race_name AS race, s.species_name AS species
     FROM entity.entities e
     LEFT JOIN entity.races r ON r.id = e.race_id
     LEFT JOIN entity.species s ON s.id = e.species_id
     WHERE e.id = $1`,
    [id],
  );
  const h = head.rows[0];
  if (!h) return null;
  const [stats, moves, traits, body] = await Promise.all([
    pool.query('SELECT stat, base, exp FROM entity.entity_stats WHERE entity_id = $1 ORDER BY stat', [id]),
    pool.query(
      `SELECT m.move_name, k.level, k.exp, l.slot
       FROM entity.known_moves k JOIN moves.moves m ON m.id = k.move_id
       LEFT JOIN entity.loadouts l ON l.entity_id = k.entity_id AND l.move_id = k.move_id
       WHERE k.entity_id = $1 ORDER BY l.slot NULLS LAST, m.move_name`,
      [id],
    ),
    pool.query(
      'SELECT t.trait_name FROM entity.entity_traits et JOIN entity.traits t ON t.id = et.trait_id WHERE et.entity_id = $1 ORDER BY 1',
      [id],
    ),
    pool.query('SELECT hp, stamina, mana FROM entity.entity_body WHERE entity_id = $1', [id]),
  ]);
  const b = body.rows[0];
  return {
    id: h.id, kind: h.kind, name: h.name, alive: h.alive, race: h.race, species: h.species, location: h.location_ref,
    slot: Number(h.slot ?? 1), fame: Number(h.fame),
    stats: stats.rows.map((r) => ({ stat: r.stat, base: Number(r.base), exp: Number(r.exp) })),
    moves: moves.rows.map((r) => ({ name: r.move_name, level: r.level, exp: Number(r.exp), slot: r.slot ?? null })),
    traits: traits.rows.map((r) => r.trait_name),
    body: b ? { hp: Number(b.hp), stamina: Number(b.stamina), mana: Number(b.mana) } : null,
  };
}
