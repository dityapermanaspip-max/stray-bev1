import { parseInterior } from '../interior/interior_ref.ts';

// Which field an exit leads to. Open hex fields have exits d0-d5, one per hex direction;
// a border between hex A and hex B is a chain of corridors 1..n from A to B, each with exits a (toward A) and b (toward B).
// A hex that holds a town has a 'gate' exit in its middle into the town field, whose only exit 'gate' leads back.

export type Hex = { id: string; q: number; r: number; town?: boolean };
export type Border = { a: Hex; b: Hex; corridors: string[] }; // corridor ids in position order
export type WorldLinks = { hexes: Map<string, Hex>; borders: Border[]; towns: Map<string, string> }; // towns: town id -> hex id
export type ExitTarget = { ref: string; exit: string };

// Axial neighbor offsets matching exit angles d0 = 0°, d1 = 60° ... (screen y down).
export const HEX_DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export function directionTo(from: Hex, to: Hex): number {
  return HEX_DIRS.findIndex(([dq, dr]) => from.q + dq === to.q && from.r + dr === to.r);
}

// The hex a field lies in when it is a hex or a town (the fog lifts for it), else null.
export const hexOf = (world: WorldLinks, ref: string) => world.towns.get(ref) ?? (world.hexes.has(ref) ? ref : null);

// The town inside a hex, if any.
export const townOf = (world: WorldLinks, hexId: string) => [...world.towns].find(([, hex]) => hex === hexId)?.[0] ?? null;

export function linkExit(world: WorldLinks, ref: string, exit: string): ExitTarget | null {
  const room = parseInterior(ref); // a room's only exit leads back to where it hangs off
  if (room) return exit === 'door' ? { ref: room.parent, exit: room.node === null ? `door:${room.kind}` : `node:${room.node}` } : null;
  const townHex = world.towns.get(ref);
  if (townHex) return exit === 'gate' ? { ref: townHex, exit: 'gate' } : null;
  const hex = world.hexes.get(ref);
  if (hex) {
    if (exit === 'gate') { const town = townOf(world, ref); return town ? { ref: town, exit: 'gate' } : null; }
    for (const border of world.borders) {
      if (border.corridors.length === 0) continue;
      if (border.a.id === hex.id && `d${directionTo(hex, border.b)}` === exit) return { ref: border.corridors[0], exit: 'a' };
      if (border.b.id === hex.id && `d${directionTo(hex, border.a)}` === exit) return { ref: border.corridors[border.corridors.length - 1], exit: 'b' };
    }
    return null;
  }
  for (const border of world.borders) {
    const i = border.corridors.indexOf(ref);
    if (i < 0) continue;
    if (exit === 'a') return i === 0 ? { ref: border.a.id, exit: `d${directionTo(border.a, border.b)}` } : { ref: border.corridors[i - 1], exit: 'b' };
    if (exit === 'b') {
      const last = border.corridors.length - 1;
      return i === last ? { ref: border.b.id, exit: `d${directionTo(border.b, border.a)}` } : { ref: border.corridors[i + 1], exit: 'a' };
    }
  }
  return null;
}
