import { savePosition } from '../data/position_repo.ts';
import type { ExitTarget } from '../field/links.ts';
import { besideTiles } from '../field/nodes.ts';
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

export async function travelTo(world: GameWorld, entityId: string, target: ExitTarget, fromTown: string | null, here: { x: number; y: number }): Promise<void> {
  const field = await gridFor(world, target.ref);
  const spot = (field && spotFor(field.grid, target.exit)) ?? field?.grid.spawn ?? here;
  await savePosition(world.pool, entityId, { fieldRef: target.ref, x: spot.x, y: spot.y });
  if (fromTown) await leaveVisit(world.pool, entityId, fromTown);
}
