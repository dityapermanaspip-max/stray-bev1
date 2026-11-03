import type { Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import type { Walker } from '../field/walker.ts';
import type { Pending } from './ask.ts';

// Synced field state: who stands where. Kept small; the tile grid goes once per join as a message.

export const FieldPlayer = schema({
  name: t.string(),
  x: t.uint8(),
  y: t.uint8(),
  walking: t.boolean(),
  stepMs: t.uint16(), // time per tile, so the client can animate between tiles
  connected: t.boolean().default(true),
}, 'FieldPlayer');
export type FieldPlayer = SchemaType<typeof FieldPlayer>;

export const FieldState = schema({
  players: t.map(FieldPlayer), // by sessionId
}, 'FieldState');
export type FieldState = SchemaType<typeof FieldState>;

// A seated player's room-side data. grace: steps left before encounters roll again (after entering or an encounter).
// door: the town service the player went into. ask: the yes / no question waiting. mealEnds: when the hidden meal
// effect runs out (ms), to say so then. aim: the resource node the walk heads for (it ends beside it).
// talk: the NPC (room node id) the player stands beside and is talking to.
export type Seat = {
  entityId: string; name: string; walker: Walker; speed: number; luck: number; grace: number; leaving: boolean;
  door: string | null; ask: Pending | null; mealEnds: number | null; aim: number | null; talk: number | null;
};
export type FieldClient = Client<{ userData: Seat }>;
