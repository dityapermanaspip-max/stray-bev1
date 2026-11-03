import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import type { LadderConfig, StandingConfig } from '../config/standing_config.ts';
import { loadNamePools } from '../names/name_repo.ts';
import { rollName, rollSex } from '../names/name_gen.ts';
import type { Rng } from '../util/rng.ts';
import { worldHourMs } from '../world/clock.ts';
import { pairCap } from './ladder.ts';
import { fameShares, type Standing } from './standing.ts';

// Standing in the DB: door keepers (world.town_keepers), town visits, town fame, favor (social.favor) and
// trade standing (social.trade_standing). All hidden.

type Db = pg.Pool | pg.PoolClient;

// The NPC behind a town door, made on first need, of the town's folk with a name from the generator. Two players
// asking at once both get the same keeper (one advisory lock per door).
export async function keeperFor(pool: pg.Pool, townRef: string, service: string, rng: Rng): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`keeper:${townRef}:${service}`]);
    const found = await client.query<{ id: string }>('SELECT entity_id::text AS id FROM world.town_keepers WHERE town_ref = $1 AND service = $2', [townRef, service]);
    if (found.rows[0]) {
      await client.query('COMMIT');
      return found.rows[0].id;
    }
    // A town field is world.towns.id (the town's culture sets the folk); the old one-town dev round is a plain hex.
    const town = await client.query<{ round: string; race: string | null }>(
      `SELECT t.round_id::text AS round, r.race_name AS race FROM world.towns t
       LEFT JOIN world.cultures c ON c.culture_name = t.culture LEFT JOIN entity.races r ON r.id = c.race_id
       WHERE t.id::text = $1 OR t.hex_id::text = $1
       UNION ALL SELECT h.round_id::text, NULL FROM world.hexes h WHERE h.id::text = $1 LIMIT 1`, [townRef],
    );
    if (!town.rows[0]) throw new Error(`no town ${townRef}`);
    const race = town.rows[0].race ?? 'human';
    const sex = rollSex(rng);
    const name = rollName(await loadNamePools(client), race, sex, false, rng) ?? service;
    const made = await client.query<{ id: string }>(
      `INSERT INTO entity.entities (kind, name, round_id, location_ref, race_id, body_type)
       VALUES ('native', $2, $5, $1, (SELECT id FROM entity.races WHERE race_name = $3), $4) RETURNING id::text AS id`,
      [townRef, name, race, sex, town.rows[0].round],
    );
    await client.query('INSERT INTO world.town_keepers (town_ref, service, entity_id) VALUES ($1, $2, $3)', [townRef, service, made.rows[0].id]);
    await client.query('COMMIT');
    return made.rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
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

// A player's standing with one keeper in one town, for this visit. No open visit means no haggle. `base` is the
// keeper's own base threshold (ladder_repo.npcBase).
export async function loadStanding(pool: pg.Pool, l: LadderConfig, entityId: string, keeperId: string, townRef: string, charm: number, base: number): Promise<Standing> {
  const res = await pool.query<{ favor: string | null; fame: string | null; pushover: boolean | null; same_visit: boolean | null; won: boolean | null; visit: boolean; pb: string | null; kb: string | null }>(
    `SELECT f.favor, tf.fame, ts.pushover_until > now() AS pushover, ts.haggle_visit = v.started_at AS same_visit,
            ts.haggle_won AS won, v.started_at IS NOT NULL AS visit, pe.body_type AS pb, ke.body_type AS kb
     FROM (SELECT 1) one
     LEFT JOIN social.favor f ON f.entity_id = $1 AND f.target_id = $2
     LEFT JOIN world.town_fame tf ON tf.entity_id = $1 AND tf.town_ref = $3
     LEFT JOIN social.trade_standing ts ON ts.entity_id = $1 AND ts.target_id = $2
     LEFT JOIN world.town_visits v ON v.entity_id = $1 AND v.town_ref = $3 AND v.left_at IS NULL
     LEFT JOIN entity.entities pe ON pe.id = $1
     LEFT JOIN entity.entities ke ON ke.id = $2`,
    [entityId, keeperId, townRef],
  );
  const r = res.rows[0]!;
  const haggle = !r.visit ? 'spent' : r.same_visit ? (r.won ? 'won' : 'spent') : 'open';
  return { favor: Number(r.favor ?? 0), base, capTier: pairCap(l, r.pb, r.kb), fame: Number(r.fame ?? 0), charm, pushover: r.pushover === true, haggle };
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
    'SELECT t.id::text AS ref, h.q, h.r FROM world.towns t JOIN world.hexes h ON h.id = t.hex_id WHERE t.round_id = $1', [roundId],
  )).rows;
  const shares = fameShares(cfg, from, towns, amount);
  if (shares.length === 0) return;
  await db.query(
    `INSERT INTO world.town_fame (town_ref, entity_id, fame) SELECT x.ref, $1, x.amount FROM unnest($2::text[], $3::numeric[]) AS x(ref, amount)
     ON CONFLICT (town_ref, entity_id) DO UPDATE SET fame = world.town_fame.fame + EXCLUDED.fame`,
    [entityId, shares.map((s) => s.ref), shares.map((s) => s.amount)],
  );
}
