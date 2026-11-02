import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { loadEntityState } from '../data/entity_load.ts';
import { inTransaction, writeLoadout, writeProgress } from '../data/entity_save.ts';
import { addMoveExp, type Progress } from '../growth/level_up.ts';
import type { MoveDef } from '../battle/types.ts';
import { STATS } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { rollMoves } from '../world/creature_roll.ts';
import { bossStats, carriedWeakening, hasFullSet, totalWeakening } from './boss_rules.ts';

// The boss in the DB (hidden). One per round, made the first time someone reaches its chamber. It grows only by
// feeding on vices born after the round start (through addMoveExp, like any growth), never in its fights.

type Db = pg.PoolClient;

// The round's boss id, made on first need: stats from boss_total, moves rolled from its list, best ones equipped.
export async function ensureBoss(pool: pg.Pool, cfg: BalanceConfig, roundId: string, rng: Rng): Promise<string> {
  return inTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`boss:${roundId}`]);
    const have = await client.query<{ id: string }>('SELECT entity_id::text AS id FROM world.boss_state WHERE round_id = $1', [roundId]);
    if (have.rows[0]) return have.rows[0].id;
    const made = await client.query<{ id: string }>(
      `INSERT INTO entity.entities (kind, name, race_id, round_id, location_ref)
       SELECT 'boss', 'boss', r.id, $1, (SELECT id::text FROM world.hexes WHERE round_id = $1 AND q = 0 AND r = 0)
       FROM entity.races r WHERE r.race_name = $2 RETURNING id`, [roundId, cfg.boss.race],
    );
    const id = made.rows[0]?.id;
    if (!id) throw new Error(`boss race ${cfg.boss.race} unknown`);
    const stats = bossStats(cfg.rings.bossTotal);
    const list = cfg.boss.moves;
    const moves = rollMoves(cfg, { pool: list, open: list, rules: [], budget: cfg.boss.moveBudget, die: cfg.creatureGen.die.get(1)!, rng });
    const progress: Progress = {
      stats: Object.fromEntries(STATS.map((s) => [s, { base: stats[s], exp: 0 }])) as Progress['stats'],
      moves: new Map(moves.map((m) => [m.name, { level: m.level, exp: 0 }])), recipes: new Set(),
    };
    await writeProgress(client, id, progress, true);
    await writeLoadout(client, id, new Map(moves.filter((m) => m.equipped).map((m, i) => [i + 1, m.name])));
    await client.query('INSERT INTO world.boss_state (round_id, entity_id) VALUES ($1, $2)', [roundId, id]);
    return id;
  });
}

// Every vice born after the start feeds the boss once: exp_per_vice move exp to one of its moves at random.
export async function feedBoss(pool: pg.Pool, cfg: BalanceConfig, moves: ReadonlyMap<string, MoveDef>, roundId: string, rng: Rng): Promise<number> {
  return inTransaction(pool, async (client) => {
    const st = (await client.query<{ id: string; fed: number; born: string }>(
      `SELECT b.entity_id::text AS id, b.vices_fed AS fed,
              (SELECT count(*) FROM world.vice_state v WHERE v.round_id = b.round_id AND v.born <> 'start') AS born
       FROM world.boss_state b WHERE b.round_id = $1 FOR UPDATE OF b`, [roundId],
    )).rows[0];
    const due = st ? Number(st.born) - st.fed : 0;
    if (!st || due <= 0) return 0;
    const state = await loadEntityState(pool, st.id); // the lock above keeps anyone else from feeding meanwhile
    const known = [...state.progress.moves.keys()];
    for (let i = 0; i < due && known.length > 0; i++) {
      const name = known[Math.floor(rng() * known.length)];
      const def = moves.get(name);
      if (def) addMoveExp(state.progress, name, cfg.boss.expPerVice, { statExp: def.statExp, expScaling: def.expScaling, tier: def.tier, tags: def.tags }, cfg);
    }
    await writeProgress(client, st.id, state.progress, true);
    await client.query('UPDATE world.boss_state SET vices_fed = $2 WHERE round_id = $1', [roundId, Number(st.born)]);
    return due;
  });
}

export type BossEntry = { sealed: true } | { sealed: false; keys: string[]; weaken: number };

// The chamber: without a key of every type it stays sealed. Otherwise one key of each type (the oldest) is spent,
// the attempt counted and the shared weakening grown, in one transaction. Weakening = carried keys + every set spent.
export async function enterBoss(pool: pg.Pool, cfg: BalanceConfig, roundId: string, playerId: string): Promise<BossEntry> {
  return inTransaction(pool, async (client: Db) => {
    const keys = (await client.query<{ id: string; vice_type: string }>(
      `SELECT id::text, vice_type FROM item.keys WHERE round_id = $1 AND holder_entity_id = $2 AND consumed_at IS NULL
       ORDER BY created_at, id FOR UPDATE`, [roundId, playerId],
    )).rows;
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k.vice_type, (counts.get(k.vice_type) ?? 0) + 1);
    if (!hasFullSet(cfg.vice.types, counts)) return { sealed: true };
    const spent = cfg.vice.types.map((t) => keys.find((k) => k.vice_type === t)!.id);
    await client.query('UPDATE item.keys SET consumed_at = now() WHERE id = ANY($1::uuid[])', [spent]);
    const st = await client.query<{ w: string }>(
      'UPDATE world.boss_state SET attempts = attempts + 1, key_weakening = key_weakening + $2 WHERE round_id = $1 RETURNING key_weakening AS w',
      [roundId, cfg.boss.setWeakening],
    );
    return { sealed: false, keys: spent, weaken: totalWeakening(cfg.boss, carriedWeakening(cfg.boss, counts), Number(st.rows[0]?.w ?? 0)) };
  });
}

// Ends the round once its closing period is over. True when it ended now (or had already ended).
export async function closeRoundIfDue(pool: pg.Pool, roundId: string): Promise<boolean> {
  const res = await pool.query<{ status: string }>(
    `UPDATE world.rounds SET status = CASE WHEN closes_at <= now() AND status IN ('active', 'dev') THEN 'ended' ELSE status END,
            ended_at = CASE WHEN closes_at <= now() AND ended_at IS NULL THEN now() ELSE ended_at END
     WHERE id = $1 RETURNING status`, [roundId],
  );
  return res.rows[0]?.status === 'ended';
}

// The fight could not be opened: the spent keys go back to their holder.
export async function refundKeys(pool: pg.Pool, keys: readonly string[]): Promise<void> {
  await pool.query('UPDATE item.keys SET consumed_at = NULL WHERE id = ANY($1::uuid[])', [keys]);
}

// The boss fell: the Demon Slayer title for the winner's account (a dev player gets an account by their name). The
// first fall starts the round's closing period (closingHours real hours); later winners in it earn the title too.
export async function recordSlayer(client: Db, roundId: string, playerId: string, closingHours: number): Promise<void> {
  const acc = await client.query<{ id: string }>(
    `WITH p AS (SELECT account_id, name FROM entity.entities WHERE id = $1),
          made AS (INSERT INTO account.accounts (name) SELECT name FROM p WHERE account_id IS NULL
                   ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id)
     SELECT coalesce((SELECT account_id FROM p), (SELECT id FROM made))::text AS id`, [playerId],
  );
  const accountId = acc.rows[0]?.id;
  if (!accountId) return;
  await client.query('UPDATE entity.entities SET account_id = $2 WHERE id = $1 AND account_id IS NULL', [playerId, accountId]);
  await client.query(
    `INSERT INTO account.achievements (account_id, type, round_id) VALUES ($1, 'demon_slayer', $2) ON CONFLICT DO NOTHING`, [accountId, roundId],
  );
  await client.query(
    `UPDATE world.rounds SET closes_at = coalesce(closes_at, now() + make_interval(secs => $2)) WHERE id = $1`, [roundId, closingHours * 3600],
  );
  await client.query('UPDATE world.boss_state SET defeated_at = coalesce(defeated_at, now()), defeated_by = coalesce(defeated_by, $2) WHERE round_id = $1', [roundId, playerId]);
}
