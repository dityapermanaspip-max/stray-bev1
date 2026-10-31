import type pg from 'pg';
import { BIOME_NAME_PREFIX } from '../db/startup_check.ts';
import { HEX_DIRS } from '../field/links.ts';
import type { GameWorld } from '../game/world.ts';
import type { MapHex, MapPoint, MapSeen, MapView } from '../../shared/map.ts';

// The world map with fog of war, for one player. Visited hexes are stored (world.known_hexes); glimpsed ones are
// worked out: neighbors of a visited hex, and both ends of the corridor the player stands in.

export async function markVisited(pool: pg.Pool, entityId: string, hexId: string): Promise<void> {
  await pool.query('INSERT INTO world.known_hexes (entity_id, hex_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entityId, hexId]);
}

type Row = { id: string; q: number; r: number; biome: string | null; town: boolean; visited: boolean };

// Pure: which hexes are visited, glimpsed or fog. `ends`: the hexes at both ends of the player's corridor.
export function fog(rows: { id: string; q: number; r: number; visited: boolean }[], ends: string[]): Map<string, MapSeen> {
  const byPlace = new Map(rows.map((h) => [`${h.q},${h.r}`, h.id]));
  const seen = new Map<string, MapSeen>(rows.map((h) => [h.id, h.visited ? 'visited' : 'fog']));
  const glimpse = (id: string | undefined) => { if (id && seen.get(id) === 'fog') seen.set(id, 'glimpsed'); };
  for (const h of rows) {
    if (!h.visited) continue;
    for (const [dq, dr] of HEX_DIRS) glimpse(byPlace.get(`${h.q + dq},${h.r + dr}`));
  }
  for (const id of ends) glimpse(id);
  return seen;
}

export async function mapView(world: GameWorld, entityId: string, ref: string): Promise<MapView> {
  const rows = (await world.pool.query<Row>(
    `SELECT h.id::text, h.q, h.r, h.biome, h.field_kind = 'town' AS town, k.entity_id IS NOT NULL AS visited
     FROM world.hexes h LEFT JOIN world.known_hexes k ON k.hex_id = h.id AND k.entity_id = $2
     WHERE h.round_id = $1 ORDER BY h.q, h.r`,
    [world.roundId, entityId],
  )).rows;
  const border = world.links.borders.find((b) => b.corridors.includes(ref)) ?? null;
  const seen = fog(rows, border ? [border.a.id, border.b.id] : []);
  const name = (biome: string | null) => (biome ? world.data.lines.pick(() => 0, BIOME_NAME_PREFIX + biome)?.text ?? null : null);
  const hexes: MapHex[] = rows.map((h) => {
    const s = seen.get(h.id)!;
    return { q: h.q, r: h.r, seen: s, biome: s === 'fog' ? null : h.biome, name: s === 'fog' ? null : name(h.biome), town: s === 'visited' ? h.town : null };
  });
  const point = (id: string): MapPoint => { const h = world.links.hexes.get(id)!; return { q: h.q, r: h.r }; };
  const here = world.links.hexes.has(ref) ? point(ref) : null;
  const between = border
    ? { from: point(border.a.id), to: point(border.b.id), step: border.corridors.indexOf(ref) + 1, steps: border.corridors.length }
    : null;
  return { hexes, here, between };
}
