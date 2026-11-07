import { savePosition } from '../data/position_repo.ts';
import type { ExitTarget } from '../field/links.ts';
import { besideTiles } from '../field/nodes.ts';
import { parseInterior } from '../interior/interior_ref.ts';
import type { FieldGrid, Point } from '../field/types.ts';
import type { GameWorld } from '../game/world.ts';
import { gridFor } from '../game/world.ts';
import { leaveVisit } from '../standing/standing_repo.ts';

// Moving a player through an exit: their saved spot becomes the linked field's matching exit (or its spawn), and
// leaving a town by an exit ends the visit there. The field room then tells the client to go.
// Coming back out of a room: the exit is `door:<service>` (the town door of that service) or `node:<id>` (beside that node).
export function spotFor(grid: FieldGrid, exit: string): Point | null {
  const [how, which] = exit.split(':');
  if (how === 'door') return grid.tiles.flatMap((t, i) => (t.service === which ? [{ x: i % grid.width, y: Math.floor(i / grid.width) }] : []))[0] ?? null;
  if (how === 'node') {
    const node = grid.nodes.find((n) => n.id === Number(which));
    return node ? besideTiles(grid, node)[0] ?? null : null;
  }
  return grid.exits.find((e) => e.id === exit) ?? null;
}

// The tile a player stood on when they went into a room (a cache: lost on a restart, then the exit picks a tile beside the door or node).
// Coming back out puts them there, so they never jump to the other side of a tent or a door.
const wentInFrom = new Map<string, Point>();
const key = (entityId: string, roomRef: string) => `${entityId}|${roomRef}`;

// A remembered tile is only used when it is still a legal place to come out: the door tile, or a tile beside the node.
export function returnSpot(grid: FieldGrid, exit: string, saved: Point | undefined): Point | null {
  if (!saved) return null;
  const [how, which] = exit.split(':');
  if (how === 'node') {
    const node = grid.nodes.find((n) => n.id === Number(which));
    return node && besideTiles(grid, node).some((p) => p.x === saved.x && p.y === saved.y) ? saved : null;
  }
  const at = spotFor(grid, exit);
  return at && at.x === saved.x && at.y === saved.y ? saved : null;
}

export async function travelTo(world: GameWorld, entityId: string, target: ExitTarget, fromTown: string | null, here: { x: number; y: number }, fromRef: string | null = null): Promise<void> {
  const field = await gridFor(world, target.ref);
  if (parseInterior(target.ref)) wentInFrom.set(key(entityId, target.ref), { x: here.x, y: here.y }); // going in: remember where from
  const back = fromRef && parseInterior(fromRef) && field ? returnSpot(field.grid, target.exit, wentInFrom.get(key(entityId, fromRef))) : null;
  if (fromRef && parseInterior(fromRef)) wentInFrom.delete(key(entityId, fromRef));
  const spot = back ?? (field && spotFor(field.grid, target.exit)) ?? field?.grid.spawn ?? here;
  await savePosition(world.pool, entityId, { fieldRef: target.ref, x: spot.x, y: spot.y });
  if (fromTown) await leaveVisit(world.pool, entityId, fromTown);
}
