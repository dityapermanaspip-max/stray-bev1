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
  look: string | null; // species key of an ordinary foe (picks its art); null for everyone else
  figure: { sheet: string; tint: number | null; scale: number } | null; // a vice or the boss: a character sheet, a colour wash and a size
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
  ground: { biome: string; terrain: string }; // the field tile the fight is on; the board is drawn from its biome
};

// Client -> server: room.request('view') answers with BattleView; send('act', ActRequest) queues a move.
// The move runs when the gauge is full; a refused move comes back as a 'line'.
// id: omit to act for yourself. The player may also act for one companion they command (tier command, config).

// target: omit to use the remembered target (the server keeps one per side; a dead one is replaced by a random valid pick).
export type ActRequest = { move: string; target?: string; id?: string };
// send('set_target', SetTargetRequest): change the remembered target without using a move.
export type SetTargetRequest = { target: string; id?: string };
// send('auto', AutoRequest): on = the fighter fights by the same rule as the AI (a random usable equipped move; heals a hurt friend first); off = the player commands them again.
// id: for a companion instead of the player.
export type AutoRequest = { on: boolean; id?: string };

// send('flee'): the party tries to run (needs a full gauge, never from the boss). A refusal or a failed try comes back as a 'line'; success ends the battle with a result where fled is true.

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
  | { type: 'lock'; entity: string; target: string } // the remembered target of a commanded fighter changed
  | { type: 'order'; ids: string[] } // who acts next, first to last (no speeds, no gauges)
  | { type: 'end'; won: boolean };

export type BattleLine = { key: string; text: string | null };

export type BattleResultView = {
  won: boolean;
  fled?: boolean; // the party ran: neither won nor lost, nobody woke elsewhere
  lines: string[]; // how it ended, what was taken, what was left behind
  taken: { item: string; name: string; qty: number }[];
};

// The battle menu's gear list. send('gear_view') answers 'gear_view' with this; send('gear', GearRequest) swaps what the player
// holds (a weapon, a shield, a throwable stack) and spends the turn: it needs a full gauge. A refusal comes back as a 'line'.
// ref is the same bag ref a GearRequest wears (a piece id or a stack key); no numbers, no stats.
export type BattleGearView = {
  hands: { slot: string; name: string }[]; // what is held now
  items: { ref: string; name: string; qty: number; slot: string | null }[]; // slot: the hand it is in now (click to take it off), else null // what could be held: weapons, shields, throwables
};
