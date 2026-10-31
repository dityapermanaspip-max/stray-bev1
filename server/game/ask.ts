import { NODE_NAME_PREFIX, SERVICE_NAME_PREFIX } from '../db/startup_check.ts';
import type { AskView } from '../../shared/field.ts';
import type { Rng } from '../util/rng.ts';
import type { GameWorld } from './world.ts';

// Every change of place asks first (WORLD.md): stopping on a town door, an exit or a resource node sends a yes / no question with a
// line the player thinks; only a yes opens the door or leaves the field. Walking away drops the question.

// node: a resource node to work (dark: corrupted, so the player hears a warning).
export type Pending = { kind: 'door'; service: string } | { kind: 'exit'; exitId: string } | { kind: 'node'; node: number; nodeKind: string; dark: boolean };

// Line pools: what the player thinks before going in, and before leaving this place.
export const ASK_LINE_KEYS = { door: 'ask.door', exit: 'ask.exit' } as const;

export function askView(world: GameWorld, rng: Rng, pending: Pending): AskView {
  const lines = world.data.lines;
  const key = pending.kind === 'node' ? (pending.dark ? 'ask.node_dark' : 'ask.node') : ASK_LINE_KEYS[pending.kind];
  const text = lines.pick(rng, key, 0, 'self')?.text ?? null;
  const place = pending.kind === 'door' ? lines.pick(rng, SERVICE_NAME_PREFIX + pending.service)?.text ?? pending.service
    : pending.kind === 'node' ? lines.pick(rng, NODE_NAME_PREFIX + pending.nodeKind)?.text ?? null : null;
  return { kind: pending.kind, text, place };
}
