// Battle messages between server and client (Steps 2e, 2f). The backend owns these types; the client imports them.
// Only what the client draws: body-state tiers and their words, damage and heal numbers, sentences. No stats.

export const BATTLE_ROOM = 'battle';

export type Word = { tier: number; text: string | null };

export type BattleFighter = {
  id: string;
  side: 'party' | 'enemy';
  slot: number; // battle formation slot (front slots first, then back)
  row: 'front' | 'back'; // worked out from the slot
  name: string;
  you: boolean;
  corrupted: boolean;
  downed: boolean;
  hp: Word;
  stamina: Word | null; // own fighter only
  mana: Word | null; // own fighter only
};

// self | one_enemy | enemy_row | all_enemies | one_ally | all_allies
export type BattleMoveView = { move: string; name: string; slot: number; target: string; front: boolean }; // front: only usable from the front row

export type BattleView = {
  you: string;
  fighters: BattleFighter[];
  slots: number; // loadout size
  formation: { front: number; back: number }; // slots per row on each side
  moves: BattleMoveView[]; // own equipped moves, in slot order
  moveNames: Record<string, string>; // every move anyone here may use
  ready: boolean;
};

// Client -> server: room.request('view') answers with BattleView; send('act', ActRequest) queues a move.
// The move runs when the gauge is full; a refused move comes back as a 'line'.
export type ActRequest = { move: string; target: string };

// Server -> client: 'events' (a batch per tick), 'line' (a refusal sentence), 'result' (once, at the end).
export type BattleEventView =
  | { type: 'use'; actor: string; move: string; targets: string[] }
  | { type: 'damage'; source: string; target: string; amount: number; outcome: 'hit' | 'crit' }
  | { type: 'miss'; actor: string; target: string }
  | { type: 'heal'; target: string; amount: number }
  | { type: 'line'; entity: string; text: string; expression: string }
  | { type: 'tier'; entity: string; resource: 'hp' | 'stamina' | 'mana'; word: Word }
  | { type: 'interrupt'; entity: string; move: string }
  | { type: 'downed'; entity: string }
  | { type: 'learned'; move: string; name: string }
  | { type: 'counter'; entity: string; move: string; target: string }
  | { type: 'moved'; entity: string; slot: number; row: 'front' | 'back' } // pushed to another slot
  | { type: 'ready' }
  | { type: 'end'; won: boolean };

export type BattleLine = { key: string; text: string | null };

export type BattleResultView = {
  won: boolean;
  lines: string[]; // how it ended, what was taken, what was left behind
  taken: { item: string; name: string; qty: number }[];
};
