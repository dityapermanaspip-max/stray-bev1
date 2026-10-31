import type { BalanceConfig, BodyResource } from '../config/balance.ts';
import type { CoreStats, Derived, Stat } from '../stats/derived.ts';
import type { LinePicker } from '../presentation/line_picker.ts';
import type { UnlockRule } from '../growth/unlocks.ts';

export type Row = 'front' | 'back';
export type Side = 'party' | 'enemy';
export type Resource = 'stamina' | 'mana';
export type TargetRule = 'self' | 'one_enemy' | 'enemy_row' | 'all_enemies' | 'one_ally' | 'all_allies';
export type EntityKind = 'player' | 'native' | 'named' | 'boss' | 'recruit' | 'summoner';

export type EffectDef = {
  handler: string;
  power: number;
  durationTurns: number | null;
  chance: number;
  params: Record<string, unknown>;
};

export type RequireDef = { kind: string; value: string; amount: number | null };

export type MoveDef = {
  name: string;
  category: string;
  damageType: string | null;
  damageKind: 'physical' | 'magic' | null;
  element: string | null;
  resource: Resource | null;
  cost: number;
  target: TargetRule;
  rowRule: string;
  windup: number; // seconds, never scaled by level
  recovery: number; // seconds
  cooldown: number | null; // seconds before the move can be used again
  channel: boolean;
  expScaling: number;
  overrides: { damage: number | null; recovery: number | null; cost: number | null };
  growthTag: string;
  tags: string[];
  effects: EffectDef[];
  requires: RequireDef[];
  statExp: Partial<Record<Stat, number>>;
  gives: string[];
  brokenBy: string[];
};

export type StatusDef = {
  name: string;
  damageType: string | null;
  element: string | null;
  stackRule: 'stack' | 'strongest';
  ignoresDefense: boolean;
  tickInterval: number;
};

export type ActiveEffect =
  | { kind: 'dot'; status: string; perTick: number; remaining: number; sourceId: string }
  | { kind: 'hot'; perTick: number; remaining: number; sourceId: string; move: string; paid: boolean }
  | {
      kind: 'channel';
      move: string;
      targetId: string;
      perTick: number;
      remaining: number;
      brokenBy: string[];
      paid: boolean;
    }
  | { kind: 'guard'; move: string; reduction: number; remaining: number; resist: string[]; hitsLeft: number | null }
  | { kind: 'stun'; remaining: number }
  | { kind: 'stun_immune'; remaining: number }
  | { kind: 'silence'; remaining: number }
  | { kind: 'buff'; stat: keyof Derived; mult: number; add: number; remaining: number; move: string | null; paysOnDodge: boolean }
  | { kind: 'bind'; byId: string; remaining: number }
  | { kind: 'hold'; move: string; targetId: string; remaining: number; brokenBy: string[] }
  | { kind: 'disable_part'; part: string; remaining: number }
  | { kind: 'counter'; move: string; trigger: string; tags: string[]; status: string | null; take: number; momentum: number; power: number; params: Record<string, unknown>; reply: EffectDef | null; remaining: number }
  | { kind: 'taunt'; byId: string; remaining: number };

// Gear as the battle sees it: built once from the bag before the fight (inventory/combat_gear.ts).
export type GearTrigger = { trigger: 'on_hit' | 'on_struck' | 'on_dodge'; effect: EffectDef; move: MoveDef };
export type CombatWeapon = {
  power: number; // wield power x quality x wear
  accuracy: number;
  vsArmor: Record<string, number>;
  pieceId: string | null;
  thrownItem: string | null; // stack key of a readied stack that is spent per throw
  thrownLeft: number;
};
export type CombatGear = {
  weaponType: string | null;
  weapon: CombatWeapon | null;
  punchPower: number;
  kickPower: number;
  defense: number;
  coverage: Record<string, number>; // armor material tag -> body share covered
  armorPieces: { id: string; share: number }[];
  statAdd: Partial<Record<keyof Derived, number>>; // worn effects, after stacking falloff
  triggers: GearTrigger[];
  wear: Map<string, number>; // piece id -> durability lost this fight
  thrownSpent: number;
};

export type Phase = 'filling' | 'ready' | 'winding' | 'recovering' | 'downed';

export type PendingAction = { move: string; targetIds: string[] };

export type BattleEntity = {
  id: string;
  kind: EntityKind;
  side: Side;
  row: Row;
  speaker: string | null; // null = does not speak lines
  grows: boolean;
  corrupted: boolean;
  controller: 'ai' | 'player';
  stats: CoreStats;
  derived: Derived; // cached for this battle, recomputed from stats
  bodyParts: string[];
  weaponType: string | null;
  ammo: Map<string, number>;
  gear: CombatGear;
  moves: string[];
  moveLevels: Map<string, number>;
  resist: Map<string, number>; // `${target_kind}:${target_id}` -> mult
  hp: number;
  stamina: number;
  mana: number;
  atb: number;
  phase: Phase;
  timerMs: number;
  action: PendingAction | null;
  queued: PendingAction | null;
  effects: ActiveEffect[];
  tiers: Record<BodyResource, number>;
  immuneShown: Set<string>;
  cooldowns: Map<string, number>; // move -> ms left
};

export type HitOutcome = 'hit' | 'crit' | 'miss';

// Client-facing events. Only damage and heal carry numbers.
export type BattleEvent =
  | { type: 'use'; actor: string; move: string; targets: string[] }
  | { type: 'damage'; source: string; target: string; amount: number; outcome: 'hit' | 'crit' }
  | { type: 'miss'; actor: string; target: string }
  | { type: 'heal'; target: string; amount: number }
  | { type: 'line'; entity: string; speaker: string; key: string; tier: number; expression: string; text: string }
  | { type: 'tier'; entity: string; resource: BodyResource; tier: number }
  | { type: 'status'; entity: string; status: string; phase: 'start' | 'end' }
  | { type: 'interrupt'; entity: string; move: string }
  | { type: 'downed'; entity: string }
  | { type: 'learned'; entity: string; move: string }
  | { type: 'counter'; entity: string; move: string; target: string }
  | { type: 'end'; winner: Side };

export type BattleData = {
  cfg: BalanceConfig;
  moves: Map<string, MoveDef>;
  statuses: Map<string, StatusDef>;
  lines: LinePicker;
  unlocks: UnlockRule[]; // server-only recipe table
};
