import { readClock } from '../data/tick_repo.ts';
import { loadEntityState } from '../data/entity_load.ts';
import { saveBag } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import type { GameWorld } from '../game/world.ts';
import { progressStats } from '../growth/level_up.ts';
import { countOf, removeItem } from '../inventory/bag.ts';
import { payCoins } from '../inventory/money.ts';
import { pairCap, talkFavor, tierOf } from '../standing/ladder.ts';
import { giveGift, npcBase, talkTo } from '../standing/ladder_repo.ts';
import { addFavor } from '../standing/standing_repo.ts';
import type { Rng } from '../util/rng.ts';
import { worldHourMs } from '../world/clock.ts';
import { freeSeat, paidUntil, unlocked } from './companion_rules.ts';

// Talking to, gifting, hiring, recruiting, paying and letting go of NPCs, by favor tier (docs/DECISIONS.md, Favor
// ladder). Every answer is a line key's sentence or null; no favor, tier or wage number ever leaves here.
// The caller (a room) has already checked that the NPC stands where the player is.

export type Reply = { line: string | null; ok: boolean };

type Npc = { id: string; kind: string; ref: string | null; sex: string | null; wage: number | null; inParty: boolean; mine: boolean; own: boolean };
type Pair = { npc: Npc; base: number; cap: number; favor: number; fame: number; charm: number; tier: number };

const say = (w: GameWorld, rng: Rng, key: string) => w.data.lines.pick(rng, key, 0, 'self')?.text ?? null;
const reply = (w: GameWorld, rng: Rng, key: string, ok: boolean): Reply => ({ line: say(w, rng, key), ok });

async function loadNpc(w: GameWorld, playerId: string, npcId: string): Promise<Npc | null> {
  const res = await w.pool.query<{ id: string; kind: string; ref: string | null; sex: string | null; wage: number | null; party: string | null; owner: string | null; own: boolean }>(
    `SELECT e.id::text AS id, e.kind, e.location_ref AS ref, e.body_type AS sex, tr.wage_per_day AS wage,
            pm.party_id::text AS party, p.player_entity_id::text AS owner,
            EXISTS (SELECT 1 FROM entity.entities pl WHERE pl.id::text = $2 AND pl.summoner_id = e.id) AS own
     FROM entity.entities e
     LEFT JOIN world.town_recruits tr ON tr.entity_id = e.id
     LEFT JOIN social.party_members pm ON pm.entity_id = e.id
     LEFT JOIN social.parties p ON p.id = pm.party_id
     WHERE e.id::text = $1 AND e.alive AND e.kind IN ('recruit', 'summoner', 'native')`,
    [npcId, playerId],
  );
  const r = res.rows[0];
  return r ? { id: r.id, kind: r.kind, ref: r.ref, sex: r.sex, wage: r.wage, inParty: r.party !== null, mine: r.owner === playerId, own: r.own } : null;
}

const roleOf = (n: Npc) => (n.wage !== null ? 'mercenary' : n.kind === 'summoner' ? 'summoner' : n.kind === 'recruit' ? 'recruit' : 'default');

async function pairWith(w: GameWorld, rng: Rng, playerId: string, npc: Npc): Promise<Pair> {
  const l = w.data.cfg.standing.ladder;
  const [base, state, row, me] = await Promise.all([
    npcBase(w.pool, l, npc.id, roleOf(npc), rng),
    loadEntityState(w.pool, playerId),
    w.pool.query<{ favor: string | null; fame: string | null }>(
      `SELECT (SELECT favor FROM social.favor WHERE entity_id = $1 AND target_id = $2) AS favor,
              (SELECT fame FROM world.town_fame WHERE entity_id = $1 AND town_ref = $3) AS fame`,
      [playerId, npc.id, npc.ref],
    ),
    w.pool.query<{ sex: string | null }>('SELECT body_type AS sex FROM entity.entities WHERE id = $1', [playerId]),
  ]);
  const favor = Number(row.rows[0]?.favor ?? 0);
  const cap = pairCap(l, me.rows[0]?.sex ?? null, npc.sex);
  return { npc, base, cap, favor, fame: Number(row.rows[0]?.fame ?? 0), charm: progressStats(state.progress).charm, tier: tierOf(l, base, favor, cap) };
}

// One talk: favor from charm and fame, at most talk_cap per NPC per tick. Crossing a tier says so.
export async function talkNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc) return { line: null, ok: false };
  const l = w.data.cfg.standing.ladder;
  const p = await pairWith(w, rng, playerId, npc);
  const { hours } = await readClock(w.pool, w.roundId);
  const added = await talkTo(w.pool, l, playerId, npcId, hours, talkFavor(l, p.charm, p.fame));
  if (added === 0) return reply(w, rng, 'npc.tired', false);
  const up = tierOf(l, p.base, p.favor + added, p.cap) > p.tier;
  return reply(w, rng, up ? 'npc.tier_up' : 'npc.talk', true);
}

// A gift of one item from the bag: from the gift tier, one per NPC per real day.
export async function giftNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string, item: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc) return { line: null, ok: false };
  const l = w.data.cfg.standing.ladder;
  const p = await pairWith(w, rng, playerId, npc);
  const inv = await loadInventory(w.pool, playerId);
  if (!unlocked(l, 'gift', p.tier) || countOf(inv, item) < 1 || w.catalog.get(item)?.type === 'key') return reply(w, rng, 'npc.gift_no', false);
  if (!(await giveGift(w.pool, l, playerId, npcId))) return reply(w, rng, 'npc.gift_no', false);
  removeItem(inv, item, 1);
  await saveBag(w.pool, playerId, inv);
  return reply(w, rng, 'npc.gift', true);
}

async function partyOf(w: GameWorld, playerId: string): Promise<{ id: string; seats: number[] }> {
  const made = await w.pool.query<{ id: string }>(
    `INSERT INTO social.parties (round_id, player_entity_id) VALUES ($1, $2)
     ON CONFLICT (player_entity_id) DO UPDATE SET round_id = EXCLUDED.round_id RETURNING id::text AS id`,
    [w.roundId, playerId],
  );
  const id = made.rows[0].id;
  await dropExpired(w, id);
  const seats = await w.pool.query<{ slot: number }>('SELECT slot FROM social.party_members WHERE party_id = $1', [id]);
  return { id, seats: seats.rows.map((s) => s.slot) };
}

// Mercenaries whose paid days ran out leave.
async function dropExpired(w: GameWorld, partyId: string): Promise<void> {
  await w.pool.query("DELETE FROM social.party_members WHERE party_id = $1 AND bond = 'mercenary' AND paid_until < now()", [partyId]);
}

const seatsMax = (w: GameWorld) => w.data.cfg.formation.partyMax - 1; // the player takes the other place

async function join(w: GameWorld, playerId: string, npc: Npc, bond: 'permanent' | 'mercenary', wage: number | null): Promise<boolean> {
  const party = await partyOf(w, playerId);
  const seat = freeSeat(party.seats, seatsMax(w));
  if (seat === null) return false;
  const l = w.data.cfg.standing.ladder;
  const until = bond === 'mercenary' ? new Date(paidUntil(l, worldHourMs(w.data.cfg.worldTimeScale), Date.now(), null)) : null;
  try {
    await w.pool.query(
      'INSERT INTO social.party_members (party_id, entity_id, slot, bond, wage_per_day, paid_until) VALUES ($1, $2, $3, $4, $5, $6)',
      [party.id, npc.id, seat, bond, wage, until],
    );
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false; // taken in the meantime
    throw err;
  }
  if (bond === 'permanent') await w.pool.query('UPDATE entity.entities SET recruited_by = $2 WHERE id = $1', [npc.id, playerId]);
  return true;
}

// Hire a mercenary for a wage (first payment now), from the hire tier. Money only.
export async function hireNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc || npc.wage === null || npc.inParty) return reply(w, rng, 'recruit.refuse', false);
  const p = await pairWith(w, rng, playerId, npc);
  if (!unlocked(w.data.cfg.standing.ladder, 'hire', p.tier)) return reply(w, rng, 'recruit.refuse', false);
  const inv = await loadInventory(w.pool, playerId);
  if (!payCoins(w.data.cfg, w.catalog, inv, npc.wage * w.data.cfg.standing.ladder.hireDays)) return reply(w, rng, 'recruit.no_money', false);
  if (!(await join(w, playerId, npc, 'mercenary', npc.wage))) return reply(w, rng, 'recruit.full', false);
  await saveBag(w.pool, playerId, inv);
  return reply(w, rng, 'recruit.hired', true);
}

// Recruit for good, from the party tier. The player's own summoner starts there.
export async function recruitNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc || npc.kind === 'native' || npc.inParty || (npc.kind === 'summoner' && !npc.own)) return reply(w, rng, 'recruit.refuse', false); // a summoner is only their own player's
  const p = await pairWith(w, rng, playerId, npc);
  if (!unlocked(w.data.cfg.standing.ladder, 'party', p.tier)) return reply(w, rng, 'recruit.refuse', false);
  return (await join(w, playerId, npc, 'permanent', null)) ? reply(w, rng, 'recruit.joined', true) : reply(w, rng, 'recruit.full', false);
}

// Pay a mercenary's next wage: extends the contract and adds salary favor on top of the talk cap.
export async function payNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  const l = w.data.cfg.standing.ladder;
  const row = npc?.mine ? (await w.pool.query<{ wage: number | null; until: Date | null }>(
    "SELECT wage_per_day AS wage, paid_until AS until FROM social.party_members WHERE entity_id = $1 AND bond = 'mercenary'", [npcId])).rows[0] : undefined;
  if (!npc || !row || row.wage === null) return reply(w, rng, 'recruit.refuse', false);
  const inv = await loadInventory(w.pool, playerId);
  if (!payCoins(w.data.cfg, w.catalog, inv, row.wage * l.hireDays)) return reply(w, rng, 'recruit.no_money', false);
  const until = new Date(paidUntil(l, worldHourMs(w.data.cfg.worldTimeScale), Date.now(), row.until?.getTime() ?? null));
  await w.pool.query('UPDATE social.party_members SET paid_until = $2 WHERE entity_id = $1', [npcId, until]);
  await addFavor(w.pool, playerId, npcId, l.salaryFavor);
  await saveBag(w.pool, playerId, inv);
  return reply(w, rng, 'recruit.paid', true);
}

// Let a companion go. They return to the town they were recruited from.
export async function dismissNpc(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Reply> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc?.mine) return { line: null, ok: false };
  await w.pool.query('DELETE FROM social.party_members WHERE entity_id = $1', [npcId]);
  await w.pool.query('UPDATE entity.entities SET recruited_by = NULL WHERE id = $1', [npcId]);
  return reply(w, rng, 'recruit.dismissed', true);
}

// How an NPC stands with the player, for the talk menu: favor tier (a word upstream, never a number), wage, party.
export type Bearing = { tier: number; wage: number | null; inParty: boolean; mine: boolean; kind: string };
export async function bearingOf(w: GameWorld, rng: Rng, playerId: string, npcId: string): Promise<Bearing | null> {
  const npc = await loadNpc(w, playerId, npcId);
  if (!npc) return null;
  return { tier: (await pairWith(w, rng, playerId, npc)).tier, wage: npc.wage, inParty: npc.inParty, mine: npc.mine, kind: npc.kind };
}

// The ids of the player's companions now (expired mercenaries have left), in seat order.
export async function companionsOf(w: GameWorld, playerId: string): Promise<string[]> {
  const party = await partyOf(w, playerId);
  const res = await w.pool.query<{ id: string }>('SELECT entity_id::text AS id FROM social.party_members WHERE party_id = $1 ORDER BY slot', [party.id]);
  return res.rows.map((r) => r.id);
}
