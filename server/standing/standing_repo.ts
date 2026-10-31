import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import type { StandingConfig } from '../config/standing_config.ts';
import { worldHourMs } from '../world/clock.ts';
import { fameShares, type Standing } from './standing.ts';

// Standing in the DB: door keepers (world.town_keepers), town visits, town fame, favor (social.favor) and
// trade standing (social.trade_standing). All hidden.

type Db = pg.Pool | pg.PoolClient;

// The NPC behind a town door, made on first need. Two players asking at once both get the same keeper.
export async function keeperFor(pool: pg.Pool, townRef: string, service: string): Promise<string> {
  const find = () => pool.query<{ id: string }>('SELECT entity_id::text AS id FROM world.town_keepers WHERE town_ref = $1 AND service = $2', [townRef, service]);
  const found = (await find()).rows[0];
  if (found) return found.id;
  await pool.query(
    `WITH e AS (
       INSERT INTO entity.entities (kind, name, round_id, location_ref)
       SELECT 'native', $2, h.round_id, $1 FROM world.hexes h WHERE h.id::text = $1 RETURNING id
     )
     INSERT INTO world.town_keepers (town_ref, service, entity_id) SELECT $1, $2, id FROM e ON CONFLICT DO NOTHING`,
    [townRef, service],
  );
  const made = (await find()).rows[0];
  if (!made) throw new Error(`no town hex ${townRef}`);
  // A losing racer's entity has no keeper row; remove it.
  await pool.query(
    `DELETE FROM entity.entities e WHERE e.kind = 'native' AND e.name = $2 AND e.location_ref = $1
       AND NOT EXISTS (SELECT 1 FROM world.town_keepers k WHERE k.entity_id = e.id)`,
    [townRef, service],
  );
  return made.id;
}

// Entering a town starts a new visit, unless the player never left it (a reload or reconnect is the same visit).
export async function startVisit(pool: pg.Pool, entityId: string, townRef: string): Promise<void> {
  await pool.query(
    `INSERT INTO world.town_visits (entity_id, town_ref) VALUES ($1, $2)
     ON CONFLICT (entity_id) DO UPDATE SET town_ref = EXCLUDED.town_ref, started_at = now(), left_at = NULL
     WHERE world.town_visits.town_ref <> EXCLUDED.town_ref OR world.town_visits.left_at IS NOT NULL`,
    [entityId, townRef],
  );
}

export async function leaveVisit(pool: pg.Pool, entityId: string, townRef: string): Promise<void> {
  await pool.query('UPDATE world.town_visits SET left_at = now() WHERE entity_id = $1 AND town_ref = $2 AND left_at IS NULL', [entityId, townRef]);
}

// A player's standing with one keeper in one town, for this visit. No open visit means no haggle.
export async function loadStanding(pool: pg.Pool, entityId: string, keeperId: string, townRef: string, charm: number): Promise<Standing> {
  const res = await pool.query<{ favor: string | null; fame: string | null; pushover: boolean | null; same_visit: boolean | null; won: boolean | null; visit: boolean }>(
    `SELECT f.favor, tf.fame, ts.pushover_until > now() AS pushover, ts.haggle_visit = v.started_at AS same_visit,
            ts.haggle_won AS won, v.started_at IS NOT NULL AS visit
     FROM (SELECT 1) one
     LEFT JOIN social.favor f ON f.entity_id = $1 AND f.target_id = $2
     LEFT JOIN world.town_fame tf ON tf.entity_id = $1 AND tf.town_ref = $3
     LEFT JOIN social.trade_standing ts ON ts.entity_id = $1 AND ts.target_id = $2
     LEFT JOIN world.town_visits v ON v.entity_id = $1 AND v.town_ref = $3 AND v.left_at IS NULL`,
    [entityId, keeperId, townRef],
  );
  const r = res.rows[0]!;
  const haggle = !r.visit ? 'spent' : r.same_visit ? (r.won ? 'won' : 'spent') : 'open';
  return { favor: Number(r.favor ?? 0), fame: Number(r.fame ?? 0), charm, pushover: r.pushover === true, haggle };
}

export async function addFavor(db: Db, entityId: string, targetId: string, delta: number): Promise<void> {
  await db.query(
    `INSERT INTO social.favor (entity_id, target_id, favor) VALUES ($1, $2, $3)
     ON CONFLICT (entity_id, target_id) DO UPDATE SET favor = social.favor.favor + EXCLUDED.favor`,
    [entityId, targetId, delta],
  );
}

// The one haggle of this visit; a loss also costs favor.
export async function recordHaggle(db: Db, cfg: StandingConfig, entityId: string, keeperId: string, townRef: string, won: boolean): Promise<void> {
  await db.query(
    `INSERT INTO social.trade_standing (entity_id, target_id, haggle_visit, haggle_won)
     SELECT $1, $2, v.started_at, $4 FROM world.town_visits v WHERE v.entity_id = $1 AND v.town_ref = $3 AND v.left_at IS NULL
     ON CONFLICT (entity_id, target_id) DO UPDATE SET haggle_visit = EXCLUDED.haggle_visit, haggle_won = EXCLUDED.haggle_won`,
    [entityId, keeperId, townRef, won],
  );
  if (!won) await addFavor(db, entityId, keeperId, -cfg.haggle.failFavor);
}

// Marked a pushover (or marked again): it fades after the configured world hours.
export async function markPushover(db: Db, cfg: BalanceConfig, entityId: string, keeperId: string): Promise<void> {
  const ms = cfg.standing.pushover.hours * worldHourMs(cfg.worldTimeScale);
  await db.query(
    `INSERT INTO social.trade_standing (entity_id, target_id, pushover_until) VALUES ($1, $2, now() + $3 * interval '1 millisecond')
     ON CONFLICT (entity_id, target_id) DO UPDATE SET pushover_until = EXCLUDED.pushover_until`,
    [entityId, keeperId, ms],
  );
}

// Fame for a deed on hex (q, r): every town of the round within reach gets its share.
export async function addFame(db: Db, cfg: StandingConfig, roundId: string, entityId: string, from: { q: number; r: number }, amount: number): Promise<void> {
  const towns = (await db.query<{ ref: string; q: number; r: number }>(
    "SELECT id::text AS ref, q, r FROM world.hexes WHERE round_id = $1 AND field_kind = 'town'", [roundId],
  )).rows;
  const shares = fameShares(cfg, from, towns, amount);
  if (shares.length === 0) return;
  await db.query(
    `INSERT INTO world.town_fame (town_ref, entity_id, fame) SELECT x.ref, $1, x.amount FROM unnest($2::text[], $3::numeric[]) AS x(ref, amount)
     ON CONFLICT (town_ref, entity_id) DO UPDATE SET fame = world.town_fame.fame + EXCLUDED.fame`,
    [entityId, shares.map((s) => s.ref), shares.map((s) => s.amount)],
  );
}
