import type { Prop, RoomLayout, Seat } from '../config/interior_config.ts';
import { tileAt, type FieldGrid } from '../field/types.ts';
import type { GameWorld } from '../game/world.ts';
import { keeperFor } from '../standing/standing_repo.ts';
import type { Rng } from '../util/rng.ts';
import type { InteriorRef } from './interior_ref.ts';

// Who stands in a room, placed like resource nodes: each NPC takes a tile (blocked) and is walked up to from beside.
// A door's keeper stands at the layout's keeper spot (made on first need); the town's recruits, mercenaries and
// summoners who have not joined anyone sit in the inn's guest seats. A summoner is shown to all but only recruitable
// by their own player (recruit/companions.ts).

// id: the node id in the room's grid; entity: the NPC's entity id; role: the service (keeper) or mercenary | recruit | summoner.
export type Placed = { id: number; entity: string; name: string; role: string; sex: string | null; look: string | null; x: number; y: number };

type Row = { id: string; name: string; sex: string | null; role: string };

export async function placeNpcs(world: GameWorld, rng: Rng, room: InteriorRef, layout: RoomLayout): Promise<Placed[]> {
  const { pool } = world;
  const rows: { row: Row; seat: Seat }[] = [];
  if (layout.keeper) {
    const id = await keeperFor(pool, room.parent, room.kind, rng);
    const r = (await pool.query<{ name: string; sex: string | null }>('SELECT name, body_type AS sex FROM entity.entities WHERE id = $1', [id])).rows[0];
    if (r) rows.push({ row: { id, name: r.name, sex: r.sex, role: room.kind }, seat: layout.keeper });
  }
  if (layout.guests.length > 0) {
    const guests = await pool.query<Row>(
      `SELECT e.id::text AS id, e.name, e.body_type AS sex,
              CASE WHEN tr.wage_per_day IS NOT NULL THEN 'mercenary' WHEN e.kind = 'summoner' THEN 'summoner' ELSE 'recruit' END AS role
       FROM entity.entities e LEFT JOIN world.town_recruits tr ON tr.entity_id = e.id
       WHERE e.location_ref = $1 AND e.alive AND e.kind IN ('recruit', 'summoner') AND e.recruited_by IS NULL
         AND NOT EXISTS (SELECT 1 FROM social.party_members pm WHERE pm.entity_id = e.id)
       ORDER BY e.id LIMIT $2`,
      [room.parent, layout.guests.length],
    );
    guests.rows.forEach((row, i) => rows.push({ row, seat: layout.guests[i] }));
  }
  return rows.map(({ row, seat }, id) => ({ id, entity: row.id, name: row.name, role: row.role, sex: row.sex, look: seat.look ?? null, x: seat.x, y: seat.y }));
}

// The room's grid with the NPCs standing in it: their tiles blocked, each a node of kind 'npc' (id = Placed.id).
// Props with a `use` (a bed, a campfire) are nodes too, kind `use:<service>`, one per tile: walk up to one and its service opens.
// A copy: the cached base grid stays empty.
export const USE_PREFIX = 'use:';
export function withNpcs(base: FieldGrid, npcs: Placed[], props: Prop[] = []): FieldGrid {
  const grid: FieldGrid = { ...base, tiles: base.tiles.map((t) => ({ ...t })), nodes: [] };
  for (const n of npcs) {
    const t = tileAt(grid, n.x, n.y);
    if (!t) continue;
    t.walkable = false;
    grid.nodes.push({ id: n.id, kind: 'npc', x: n.x, y: n.y, rank: 0 });
  }
  for (const p of props) {
    if (!p.use) continue;
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) grid.nodes.push({ id: grid.nodes.length, kind: USE_PREFIX + p.use, x: p.x + dx, y: p.y + dy, rank: 0 });
  }
  return grid;
}
