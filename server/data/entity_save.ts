import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import type { Progress } from '../growth/level_up.ts';
import type { Inventory } from '../inventory/bag.ts';
import { starterLoadout, type Loadout } from '../loadout/loadout.ts';
import { STATS } from '../stats/derived.ts';
import type { BodyNow } from './entity_load.ts';
import { writeInventory } from './item_repo.ts';

// Writes growing entities. Every write that belongs together runs in one transaction.

export type BattleResult = { entityId: string; progress: Progress; body: BodyNow | null; inventory?: Inventory };

export async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function writeProgress(client: pg.PoolClient, entityId: string, progress: Progress, seen: boolean) {
  await client.query(
    `INSERT INTO entity.entity_stats (entity_id, stat, base, exp)
     SELECT $1, x.stat, x.base, x.exp FROM unnest($2::text[], $3::numeric[], $4::numeric[]) AS x(stat, base, exp)
     ON CONFLICT (entity_id, stat) DO UPDATE SET base = EXCLUDED.base, exp = EXCLUDED.exp`,
    [entityId, [...STATS], STATS.map((s) => progress.stats[s].base), STATS.map((s) => progress.stats[s].exp)],
  );
  const moves = [...progress.moves];
  // New rows keep seen = false unless told otherwise; existing rows keep their seen flag.
  await client.query(
    `INSERT INTO entity.known_moves (entity_id, move_id, level, exp, seen)
     SELECT $1, m.id, x.level, x.exp, $5
     FROM unnest($2::text[], $3::int[], $4::numeric[]) AS x(name, level, exp)
     JOIN moves.moves m ON m.move_name = x.name
     ON CONFLICT (entity_id, move_id) DO UPDATE SET level = EXCLUDED.level, exp = EXCLUDED.exp`,
    [entityId, moves.map(([n]) => n), moves.map(([, k]) => k.level), moves.map(([, k]) => k.exp), seen],
  );
}

async function writeBody(client: pg.PoolClient, entityId: string, body: BodyNow | null) {
  if (!body) {
    await client.query('DELETE FROM entity.entity_body WHERE entity_id = $1', [entityId]);
    return;
  }
  await client.query(
    `INSERT INTO entity.entity_body (entity_id, hp, stamina, mana) VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_id) DO UPDATE
     SET hp = EXCLUDED.hp, stamina = EXCLUDED.stamina, mana = EXCLUDED.mana, updated_at = now()`,
    [entityId, Math.max(0, body.hp), Math.max(0, body.stamina), Math.max(0, body.mana)],
  );
}

async function writeLoadout(client: pg.PoolClient, entityId: string, loadout: Loadout) {
  const slots = [...loadout];
  await client.query('DELETE FROM entity.loadouts WHERE entity_id = $1', [entityId]);
  await client.query(
    `INSERT INTO entity.loadouts (entity_id, slot, move_id)
     SELECT $1, x.slot, m.id FROM unnest($2::int[], $3::text[]) AS x(slot, name)
     JOIN moves.moves m ON m.move_name = x.name`,
    [entityId, slots.map(([s]) => s), slots.map(([, n]) => n)],
  );
}

// Battle end: stats, known moves (including newly learned ones), bodies and bags for every grower, at once.
// `more` adds the rest of the battle's writes (corpses, counts, positions) to the same transaction.
export async function saveBattleResults(
  pool: pg.Pool, results: BattleResult[], more?: (client: pg.PoolClient) => Promise<void>,
): Promise<void> {
  await inTransaction(pool, async (client) => {
    for (const r of results) {
      await writeProgress(client, r.entityId, r.progress, false);
      await writeBody(client, r.entityId, r.body);
      if (r.inventory) await writeInventory(client, r.entityId, r.inventory);
    }
    if (more) await more(client);
  });
}

export async function saveLoadout(pool: pg.Pool, entityId: string, loadout: Loadout): Promise<void> {
  await inTransaction(pool, (client) => writeLoadout(client, entityId, loadout));
}

// Bag and gear changes, plus any move learned or grown (a weapon's basic move, a life skill), at once.
// `first` runs in the same transaction; when it says no, nothing is written (a spent resource node).
export async function saveGear(
  pool: pg.Pool, entityId: string, inv: Inventory, progress: Progress, first?: (client: pg.PoolClient) => Promise<boolean>,
): Promise<boolean> {
  return inTransaction(pool, async (client) => {
    if (first && !(await first(client))) return false;
    await writeProgress(client, entityId, progress, false);
    await writeInventory(client, entityId, inv);
    return true;
  });
}

// A night at the inn: the payment and the rested body, at once.
export async function saveBodyAndBag(pool: pg.Pool, entityId: string, body: BodyNow | null, inv: Inventory): Promise<void> {
  await inTransaction(pool, async (client) => {
    await writeBody(client, entityId, body);
    await writeInventory(client, entityId, inv);
  });
}

export async function saveBag(pool: pg.Pool, entityId: string, inv: Inventory): Promise<void> {
  await inTransaction(pool, (client) => writeInventory(client, entityId, inv));
}

export async function saveBody(pool: pg.Pool, entityId: string, body: BodyNow | null): Promise<void> {
  await inTransaction(pool, (client) => writeBody(client, entityId, body));
}

// Opening the status window marks learned moves as seen.
export async function markMovesSeen(pool: pg.Pool, entityId: string): Promise<void> {
  await pool.query('UPDATE entity.known_moves SET seen = true WHERE entity_id = $1 AND NOT seen', [entityId]);
}

// A new player: start stats, start moves (seen), and a starter loadout. Arrival will set the rest later.
export async function createPlayer(pool: pg.Pool, cfg: BalanceConfig, name: string, raceName: string): Promise<string> {
  return inTransaction(pool, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO entity.entities (kind, name, race_id)
       SELECT 'player', $1, r.id FROM entity.races r WHERE r.race_name = $2
       RETURNING id`,
      [name, raceName],
    );
    const id = res.rows[0]?.id;
    if (!id) throw new Error(`unknown race ${raceName}`);
    const progress: Progress = {
      stats: Object.fromEntries(STATS.map((s) => [s, { base: cfg.playerStartStats[s], exp: 0 }])) as Progress['stats'],
      moves: new Map(cfg.playerStartMoves.map((m) => [m, { level: 1, exp: 0 }])),
      recipes: new Set(),
    };
    await writeProgress(client, id, progress, true);
    await writeLoadout(client, id, starterLoadout(cfg, cfg.playerStartMoves));
    return id;
  });
}
