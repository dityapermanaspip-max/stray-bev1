// Field messages between server and client (Step 2b). The backend owns these types; the client imports them.
// Only what the client draws: no populations, no encounter numbers.

export const FIELD_ROOM = 'field';

// terrain, biome, height (0-5), walkable, slope (always -1 now: flat blocks; kept for the format),
// safe (inside a town's square), door (the town service behind it, or null)
export type FieldTileView = { t: string; b: string; h: number; w: boolean; s: number; safe: boolean; door: string | null };
export type FieldView = {
  ref: string;
  rank: string[]; // biome order, gentlest first: the lower-ranked biome of a pair wears the connector tile
  kind: 'open' | 'corridor' | 'town' | 'interior';
  width: number;
  height: number;
  tiles: FieldTileView[]; // row-major: y * width + x
  exits: { id: string; x: number; y: number }[];
  nodes: { x: number; y: number; kind: string }[]; // resource nodes: rock, tree, herb, fish, camp, cave (dark or not stays hidden)
  npcs: { id: number; x: number; y: number; name: string; role: string; sex: string | null; look: string | null }[]; // people standing here (rooms); look: their actor sheet
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
// Server -> client 'ask' before a door opens or the player leaves the field: a line and, for a door, its place name.
// Client -> server 'answer': yes opens the door or leaves; no (or walking away) does nothing.
export type AskView = { kind: 'door' | 'exit' | 'node'; text: string | null; place: string | null };
// Server -> client 'gathered' after working a node: a line, and what was found (names and counts).
export type GatherNotice = { text: string | null; finds: { name: string; qty: number }[] };
export type AskAnswer = { yes: boolean };
