import type pg from 'pg';
import type { LadderConfig } from '../config/standing_config.ts';
import type { Rng } from '../util/rng.ts';
import { rollBase, thresholds, tickOf } from './ladder.ts';
import { addFavor } from './standing_repo.ts';

// The favor ladder in the DB: each NPC's rolled base threshold, the per-tick talk cap, the daily gift. Hidden.

type Db = pg.Pool | pg.PoolClient;

// An NPC's base threshold: rolled once from its role, then kept. Two callers at once both read the same row.
export async function npcBase(db: Db, l: LadderConfig, entityId: string, role: string, rng: Rng): Promise<number> {
  await db.query('INSERT INTO social.npc_standing (entity_id, base_threshold) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entityId, rollBase(l, role, rng)]);
  const res = await db.query<{ base_threshold: number }>('SELECT base_threshold FROM social.npc_standing WHERE entity_id = $1', [entityId]);
  return res.rows[0].base_threshold;
}

// One favor-giving contact (talk, shop, any service). True when it counts: at most talkCap per NPC per tick.
export async function recordTalk(db: Db, l: LadderConfig, entityId: string, targetId: string, worldHours: number): Promise<boolean> {
  const res = await db.query(
    `INSERT INTO social.talk_log (entity_id, target_id, tick, count) VALUES ($1, $2, $3, 1)
     ON CONFLICT (entity_id, target_id) DO UPDATE
       SET tick = EXCLUDED.tick, count = CASE WHEN social.talk_log.tick = EXCLUDED.tick THEN social.talk_log.count + 1 ELSE 1 END
       WHERE social.talk_log.tick <> EXCLUDED.tick OR social.talk_log.count < $4
     RETURNING count`,
    [entityId, targetId, tickOf(l, worldHours), l.talkCap],
  );
  return (res.rowCount ?? 0) > 0;
}

// A talk's favor, if the cap lets it count. Answers the favor added (0 when capped).
export async function talkTo(db: Db, l: LadderConfig, entityId: string, targetId: string, worldHours: number, gain: number): Promise<number> {
  if (!(await recordTalk(db, l, entityId, targetId, worldHours))) return 0;
  await addFavor(db, entityId, targetId, gain);
  return gain;
}

// A gift: the favor, if none was given in the last perDays real days. The caller checks the menu tier first
// (canGift). Answers whether it went through.
export async function giveGift(db: Db, l: LadderConfig, entityId: string, targetId: string, now = new Date()): Promise<boolean> {
  const res = await db.query(
    `INSERT INTO social.gift_log (entity_id, target_id, last_gift_at) VALUES ($1, $2, $3)
     ON CONFLICT (entity_id, target_id) DO UPDATE SET last_gift_at = EXCLUDED.last_gift_at
       WHERE social.gift_log.last_gift_at <= $3::timestamptz - $4 * interval '1 day'
     RETURNING 1`,
    [entityId, targetId, now, l.gift.perDays],
  );
  if (!res.rowCount) return false;
  await addFavor(db, entityId, targetId, l.gift.favor);
  return true;
}

// A player's own summoner starts with enough favor for the start tier: recruitable at once, and the player may leave them.
export async function summonerStartFavor(db: Db, l: LadderConfig, playerId: string, summonerId: string, base: number): Promise<void> {
  await addFavor(db, playerId, summonerId, thresholds(l, base)[l.summonerStartTier - 1]);
}
