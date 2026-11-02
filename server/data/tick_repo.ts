import type pg from 'pg';
import { refillNodes } from '../gather/gather_repo.ts';
import type { PopRow } from '../world/population.ts';
import type { TickReport } from '../world/town_tick.ts';
import { runHour, townDue, type HexInfo, type TickTown, type TickWorld } from '../world/world_hour.ts';
import type { Town } from './economy_repo.ts';
import { inTransaction } from './entity_save.ts';
import { runInvasions } from '../vice/invasion_repo.ts';

// One world hour for a round, in one transaction (the rules are world/world_hour.ts). Population, town stock and purse
// rows are locked while they change, so battles and trades (which move counts by deltas) wait for it.


export async function readClock(pool: pg.Pool, roundId: string): Promise<{ hours: number; at: number | null }> {
  const res = await pool.query<{ tick_hours: string; tick_at: Date | null }>('SELECT tick_hours, tick_at FROM world.rounds WHERE id = $1', [roundId]);
  const row = res.rows[0];
  return { hours: Number(row?.tick_hours ?? 0), at: row?.tick_at ? row.tick_at.getTime() : null };
}

export async function setClock(pool: pg.Pool, roundId: string, hours: number, at: number): Promise<void> {
  await pool.query('UPDATE world.rounds SET tick_hours = $2, tick_at = $3 WHERE id = $1', [roundId, hours, new Date(at)]);
}

async function lockPopulation(client: pg.PoolClient, refs: string[]): Promise<Map<string, (PopRow & { id?: string })[]>> {
  const res = await client.query<{ id: string; field_ref: string; species_name: string; natural_count: number; corrupted_count: number; safe_count: number; max_count: number }>(
    `SELECT p.id, p.field_ref, s.species_name, p.natural_count, p.corrupted_count, p.safe_count, p.max_count
     FROM world.field_population p JOIN entity.species s ON s.id = p.species_id
     WHERE p.field_ref = ANY($1) ORDER BY p.id FOR UPDATE OF p`, [refs],
  );
  const out = new Map(refs.map((ref) => [ref, [] as (PopRow & { id?: string })[]]));
  for (const r of res.rows) {
    out.get(r.field_ref)?.push({
      id: r.id, species: r.species_name, natives: Number(r.natural_count), corrupted: Number(r.corrupted_count), safe: Number(r.safe_count), max: Number(r.max_count),
    });
  }
  return out;
}

// The round's towns (keyed by town id) with the hex each stands in.
async function lockTowns(client: pg.PoolClient, roundId: string): Promise<TickTown[]> {
  const eco = await client.query<{ town_ref: string; hex: string; purse: number; max_buy: number; specialties: string[]; facilities: Record<string, number>; taboo: string[]; jobs: Record<string, number>; population: number }>(
    `SELECT e.town_ref, t.hex_id::text AS hex, e.purse, e.max_buy, e.specialties, e.facilities, e.taboo, e.jobs, e.population
     FROM world.town_economy e JOIN world.towns t ON t.id::text = e.town_ref WHERE t.round_id = $1 ORDER BY e.town_ref FOR UPDATE OF e`, [roundId],
  );
  const towns = eco.rows.map((e) => ({
    hex: e.hex,
    town: { ref: e.town_ref, purse: e.purse, maxBuy: e.max_buy, specialties: e.specialties, taboo: e.taboo ?? [], facilities: e.facilities, stock: new Map() } as Town,
    population: e.population,
    jobs: e.jobs,
  }));
  if (towns.length === 0) return towns;
  const stock = await client.query<{ town_ref: string; item_name: string; quality: string; qty: number }>(
    `SELECT s.town_ref, i.item_name, s.quality, s.qty FROM world.town_stock s JOIN item.items i ON i.id = s.item_id
     WHERE s.town_ref = ANY($1) FOR UPDATE OF s`, [towns.map((t) => t.town.ref)],
  );
  for (const s of stock.rows) {
    towns.find((t) => t.town.ref === s.town_ref)?.town.stock.set(`${s.item_name}@${s.quality}`, { item: s.item_name, quality: s.quality, qty: s.qty });
  }
  return towns;
}

async function writeTown(client: pg.PoolClient, town: Town): Promise<void> {
  const rows = [...town.stock.values()];
  await client.query(
    `INSERT INTO world.town_stock (town_ref, item_id, quality, qty)
     SELECT $1, i.id, x.quality, x.qty FROM unnest($2::text[], $3::text[], $4::int[]) AS x(item, quality, qty)
     JOIN item.items i ON i.item_name = x.item
     ON CONFLICT (town_ref, item_id, quality) DO UPDATE SET qty = EXCLUDED.qty`,
    [town.ref, rows.map((r) => r.item), rows.map((r) => r.quality), rows.map((r) => Math.max(0, r.qty))],
  );
  await client.query('UPDATE world.town_economy SET purse = $2 WHERE town_ref = $1', [town.ref, Math.max(0, town.purse)]);
}

// Runs world hour `hour` for the round. Answers each town's report (for the dev log and the simulator).
export type { TickWorld };

// The round row is locked first and its clock moves to `hour` in the same transaction, so two runners (the game
// server's ticker and the admin command) never run the same hour twice; an hour already run is skipped (no reports).
export async function runWorldHour(pool: pg.Pool, w: TickWorld, roundId: string, hour: number): Promise<Map<string, TickReport>> {
  const reports = new Map<string, TickReport>();
  await inTransaction(pool, async (client) => {
    const clock = await client.query<{ tick_hours: string }>('SELECT tick_hours FROM world.rounds WHERE id = $1 FOR UPDATE', [roundId]);
    if (Number(clock.rows[0]?.tick_hours ?? 0) >= hour) return;
    await client.query('UPDATE world.rounds SET tick_hours = $2 WHERE id = $1', [roundId, hour]);
    const hexes = (await client.query<HexInfo>('SELECT id::text AS id, q, r, ring, biome FROM world.hexes WHERE round_id = $1', [roundId])).rows;
    const pop = await lockPopulation(client, hexes.map((h) => h.id));
    const towns = townDue(w, hour) ? await lockTowns(client, roundId) : [];
    for (const [ref, r] of runHour(w, hexes, pop as Map<string, PopRow[]>, towns, hour)) reports.set(ref, r);
    await runInvasions(client, w.cfg, roundId, hour, pop, w.rng); // vices lead overflowing hexes out (moves counts)
    for (const { town } of towns) await writeTown(client, town);
    await refillNodes(client, w.cfg.gather); // resource nodes grow back
    const rows = [...pop.values()].flat().filter((r) => r.id);
    await client.query(
      `UPDATE world.field_population p SET natural_count = x.n, corrupted_count = x.c
       FROM unnest($1::uuid[], $2::int[], $3::int[]) AS x(id, n, c) WHERE p.id = x.id`,
      [rows.map((r) => r.id), rows.map((r) => Math.max(0, r.natives)), rows.map((r) => Math.max(0, r.corrupted))],
    );
  });
  return reports;
}
