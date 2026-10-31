// Field messages between server and client (Step 2b). The backend owns these types; the client imports them.
// Only what the client draws: no populations, no encounter numbers.

export const FIELD_ROOM = 'field';

// terrain, biome, height (0-3), walkable, slope (uphill direction 0-3: +x, +y, -x, -y; -1 flat),
// safe (inside a town's square), door (the town service behind it, or null)
export type FieldTileView = { t: string; b: string; h: number; w: boolean; s: number; safe: boolean; door: string | null };
export type FieldView = {
  ref: string;
  kind: 'open' | 'corridor' | 'town';
  width: number;
  height: number;
  tiles: FieldTileView[]; // row-major: y * width + x
  exits: { id: string; x: number; y: number }[];
};

export type JoinOptions = { name: string; ref: string };
export type WalkRequest = { x: number; y: number };
// Client -> server requests: room.request('view') answers with FieldView.

// Server -> client messages.
export type FieldLine = { key: string; text: string | null }; // a sentence the player hears (self speaker)
export type TravelOrder = { ref: string };
// Creatures jump out: the walk stops. `seat` is a reserved seat in the private battle room
// (client.consumeSeatReservation); null when the battle could not be set up.
export type EncounterNotice = { key: string; text: string | null; seat: unknown | null };
export type WhereAnswer = { ref: string; name: string };
