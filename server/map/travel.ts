import { savePosition } from '../data/position_repo.ts';
import type { ExitTarget } from '../field/links.ts';
import type { GameWorld } from '../game/world.ts';
import { gridFor } from '../game/world.ts';
import { leaveVisit } from '../standing/standing_repo.ts';

// Moving a player through an exit: their saved spot becomes the linked field's matching exit (or its spawn), and
// leaving a town by an exit ends the visit there. The field room then tells the client to go.
export async function travelTo(world: GameWorld, entityId: string, target: ExitTarget, fromTown: string | null, here: { x: number; y: number }): Promise<void> {
  const field = await gridFor(world, target.ref);
  const spot = field?.grid.exits.find((e) => e.id === target.exit) ?? field?.grid.spawn ?? here;
  await savePosition(world.pool, entityId, { fieldRef: target.ref, x: spot.x, y: spot.y });
  if (fromTown) await leaveVisit(world.pool, entityId, fromTown);
}
