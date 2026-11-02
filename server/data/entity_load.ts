import type pg from 'pg';
import type { Progress } from '../growth/level_up.ts';
import type { Loadout } from '../loadout/loadout.ts';
import type { Trait, TraitOption } from '../growth/traits.ts';
import { STATS, type Stat } from '../stats/derived.ts';

// Reads one growing entity (player, recruit, summoner) from the database.

export type BodyNow = { hp: number; stamina: number; mana: number };

export type EntityState = {
  id: string;
  kind: string;
  name: string;
  bodyParts: string[];
  progress: Progress;
  loadout: Loadout;
  body: BodyNow | null; // null = full
  slot: number; // battle formation slot, chosen in town
  unseen: Set<string>; // learned moves the owner has not looked at yet
  traits: Trait[]; // modifiers are hidden: server only
  raceResist: Map<string, number>; // `kind:target` -> mult from the race (entity.resistances owner_kind race)
};

export async function findEntityByName(pool: pg.Pool, kind: string, name: string): Promise<string | null> {
  const res = await pool.query<{ id: string }>(
    'SELECT id FROM entity.entities WHERE kind = $1 AND name = $2 AND alive ORDER BY id LIMIT 1',
    [kind, name],
  );
  return res.rows[0]?.id ?? null;
}

export async function loadEntityState(pool: pg.Pool, entityId: string): Promise<EntityState> {
  const [entity, stats, moves, recipes, slots, body, traits, resist] = await Promise.all([
    pool.query<{ kind: string; name: string; slot: number; body_parts: string[] | null; race: string | null }>(
      `SELECT e.kind, e.name, e.slot, coalesce(r.body_parts, s.body_parts) AS body_parts, r.race_name AS race
       FROM entity.entities e
       LEFT JOIN entity.races r ON r.id = e.race_id
       LEFT JOIN entity.species s ON s.id = e.species_id
       WHERE e.id = $1`,
      [entityId],
    ),
    pool.query<{ stat: Stat; base: string; exp: string }>(
      'SELECT stat, base, exp FROM entity.entity_stats WHERE entity_id = $1',
      [entityId],
    ),
    pool.query<{ move_name: string; level: number; exp: string; seen: boolean }>(
      `SELECT m.move_name, k.level, k.exp, k.seen
       FROM entity.known_moves k JOIN moves.moves m ON m.id = k.move_id
       WHERE k.entity_id = $1`,
      [entityId],
    ),
    pool.query<{ move_name: string }>(
      `SELECT m.move_name FROM entity.known_recipes k JOIN moves.moves m ON m.id = k.move_id
       WHERE k.entity_id = $1`,
      [entityId],
    ),
    pool.query<{ slot: number; move_name: string }>(
      `SELECT l.slot, m.move_name FROM entity.loadouts l JOIN moves.moves m ON m.id = l.move_id
       WHERE l.entity_id = $1`,
      [entityId],
    ),
    pool.query<{ hp: string; stamina: string; mana: string }>(
      'SELECT hp, stamina, mana FROM entity.entity_body WHERE entity_id = $1',
      [entityId],
    ),
    pool.query<{ trait_name: string; modifiers: Record<string, unknown>; params: Record<string, unknown> }>(
      `SELECT t.trait_name, t.modifiers, et.params FROM entity.entity_traits et JOIN entity.traits t ON t.id = et.trait_id
       WHERE et.entity_id = $1`,
      [entityId],
    ),
    pool.query<{ target_kind: string; target_id: string; mult: string }>(
      `SELECT x.target_kind, x.target_id, x.mult FROM entity.entities e
       JOIN entity.resistances x ON x.owner_kind = 'race' AND x.owner_id = e.race_id WHERE e.id = $1`,
      [entityId],
    ),
  ]);

  const row = entity.rows[0];
  if (!row) throw new Error(`entity ${entityId} not found`);
  const statRows = new Map(stats.rows.map((r) => [r.stat, r]));
  const missing = STATS.filter((s) => !statRows.has(s));
  if (missing.length > 0) throw new Error(`entity ${entityId} is missing stats: ${missing.join(', ')}`);

  const b = body.rows[0];
  return {
    id: entityId,
    kind: row.kind,
    name: row.name,
    slot: Number(row.slot ?? 1),
    bodyParts: row.body_parts ?? [],
    progress: {
      stats: Object.fromEntries(
        STATS.map((s) => [s, { base: Number(statRows.get(s)!.base), exp: Number(statRows.get(s)!.exp) }]),
      ) as Progress['stats'],
      moves: new Map(moves.rows.map((m) => [m.move_name, { level: m.level, exp: Number(m.exp) }])),
      recipes: new Set(recipes.rows.map((r) => r.move_name)),
      race: row.race ?? undefined,
    },
    loadout: new Map(slots.rows.map((s) => [s.slot, s.move_name])),
    body: b ? { hp: Number(b.hp), stamina: Number(b.stamina), mana: Number(b.mana) } : null,
    unseen: new Set(moves.rows.filter((m) => !m.seen).map((m) => m.move_name)),
    traits: traits.rows.map((t) => ({ name: t.trait_name, modifiers: t.modifiers ?? {}, params: t.params ?? {} })),
    raceResist: new Map(resist.rows.map((r) => [`${r.target_kind}:${r.target_id}`, Number(r.mult)])),
  };
}

// Every trait the quota roll may pick from (weight 0 = granted only, never rolled).
export async function loadTraitOptions(pool: pg.Pool): Promise<TraitOption[]> {
  const res = await pool.query<{ trait_name: string; cost: number; weight: number; modifiers: Record<string, unknown> }>(
    'SELECT trait_name, cost, weight, modifiers FROM entity.traits ORDER BY trait_name',
  );
  return res.rows.map((r) => ({ name: r.trait_name, cost: Number(r.cost), weight: Number(r.weight), modifiers: r.modifiers ?? {} }));
}
