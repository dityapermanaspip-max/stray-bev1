import type { RoomLayout } from '../config/interior_config.ts';
import { reachable } from '../field/reach.ts';
import { tileAt, type FieldGrid, type Tile } from '../field/types.ts';

// A room's tile grid, built from its layout alone (same layout, same room). The back walls and the props are blocked;
// the exit 'door' is the middle of the last row, which is also where a player arrives.

export function buildInterior(l: RoomLayout): FieldGrid {
  const tiles: Tile[] = [];
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      const wall = l.wall !== null && (x === 0 || y === 0);
      tiles.push({ terrain: wall ? l.wall! : l.floor, biome: l.biome, height: 0, walkable: !wall, slope: null });
    }
  }
  const grid: FieldGrid = { width: l.w, height: l.h, tiles, spawn: { x: Math.floor(l.w / 2), y: l.h - 1 }, exits: [], nodes: [] };
  grid.exits.push({ id: 'door', ...grid.spawn });
  for (const p of l.props) {
    for (let dy = 0; dy < p.h; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        const t = tileAt(grid, p.x + dx, p.y + dy);
        if (t) [t.terrain, t.walkable] = [p.terrain, false];
      }
    }
  }
  if (l.rest) {
    const t = tileAt(grid, l.rest.x, l.rest.y);
    if (t) t.service = l.rest.service;
  }
  return grid;
}

// What is wrong with a layout: a seat, the rest tile or a tile beside the keeper that cannot be reached from the door.
export function findRoomProblems(name: string, l: RoomLayout): string[] {
  const grid = buildInterior(l);
  const seen = reachable(grid, grid.spawn);
  const open = (x: number, y: number) => seen.has(y * l.w + x);
  const beside = (s: { x: number; y: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => open(s.x + dx, s.y + dy));
  const out: string[] = [];
  if (l.keeper && !beside(l.keeper)) out.push(`interior ${name}: nothing to stand on beside the keeper`);
  l.guests.forEach((s, i) => { if (!beside(s)) out.push(`interior ${name}: guest seat ${i} cannot be reached`); });
  if (l.rest && !open(l.rest.x, l.rest.y)) out.push(`interior ${name}: the rest tile cannot be reached`);
  return out;
}
