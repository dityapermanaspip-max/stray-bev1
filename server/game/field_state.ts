import { schema, t, type SchemaType } from '@colyseus/schema';

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
