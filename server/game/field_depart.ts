import { CloseCode } from '@colyseus/core';
import { isBossHex, passBossGate } from '../boss/boss_entry.ts';
import { linkExit, type ExitTarget } from '../field/links.ts';
import type { FieldKind } from '../field/types.ts';
import { travelTo } from '../map/travel.ts';
import type { Rng } from '../util/rng.ts';
import type { Foe } from '../world/encounter.ts';
import type { EncounterNotice, TravelOrder } from '../../shared/field.ts';
import { openBattle, type BattleOrder } from './battle_setup.ts';
import type { FieldClient, FieldState, Seat } from './field_state.ts';
import type { GameWorld } from './world.ts';

// Leaving a field room: into a battle, through an exit, into a room (a town building, a camp, a cave) or the boss gate.
// The room passes itself as the host; the client is told to go and then closed with a consented close, or the SDK
// would reconnect into the old room.

export type DepartHost = {
  world: GameWorld; ref: string; kind: FieldKind; rng: Rng; state: FieldState;
  clock: { setTimeout(fn: () => void, ms: number): unknown };
  save(client: FieldClient): void;
  say(client: FieldClient, key: string): void;
};

const TRAVEL_GRACE_MS = 5000;

// Hands the player to a private battle room (battle_setup.ts) and sends them off.
export async function startBattle(h: DepartHost, client: FieldClient, seat: Seat, foes: Foe[]): Promise<boolean> {
  const key = foes.some((f) => f.boss) ? 'boss.enter' : foes.some((f) => f.vice) ? 'field.encounter.vice' : 'field.encounter';
  const line = h.world.data.lines.pick(h.rng, key, 0, 'self');
  const { x, y } = seat.walker;
  const order: BattleOrder = { entityId: seat.entityId, name: seat.name, fieldRef: h.ref, x, y, foes, seed: Math.floor(h.rng() * 2 ** 31) };
  const notice: EncounterNotice = { key, text: line?.text ?? null, seat: await openBattle(order) };
  if (!notice.seat) seat.leaving = false;
  client.send('encounter', notice); // like travel: the client leaves first, then a consented close
  if (notice.seat) h.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
  return !!notice.seat;
}

// Save the player at the target and tell the client to go. fromTown: the town whose visit this ends.
export function sendTo(h: DepartHost, client: FieldClient, seat: Seat, target: ExitTarget, fromTown: string | null): void {
  seat.leaving = true;
  seat.walker.path = [];
  void travelTo(h.world, seat.entityId, target, fromTown, seat.walker).then(() => {
    client.send('travel', { ref: target.ref } satisfies TravelOrder);
    h.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
  }).catch((err: Error) => console.error(`travel failed: ${err.message}`));
}

// Stepping onto an exit: save the player at the linked field and send them there (into the boss hex: boss_entry.ts).
export function leaveBy(h: DepartHost, client: FieldClient, exitId: string): boolean {
  const seat = client.userData!;
  const target = linkExit(h.world.links, h.ref, exitId);
  if (!target) return h.say(client, 'field.no_way'), false;
  if (isBossHex(h.world.links, target.ref)) return seat.leaving = true, seat.walker.path = [], void bossGate(h, client, seat), true;
  sendTo(h, client, seat, target, h.kind === 'town' ? h.ref : null);
  return true;
}

async function bossGate(h: DepartHost, client: FieldClient, seat: Seat) {
  const line = await passBossGate(h.world, seat.entityId, h.rng, (foes) => startBattle(h, client, seat, foes));
  if (line) (seat.leaving = false), h.say(client, line); // sealed: a key of every type is needed
}
