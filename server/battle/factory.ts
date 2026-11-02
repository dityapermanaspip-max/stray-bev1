import type { BalanceConfig } from '../config/balance.ts';
import type { Progress } from '../growth/level_up.ts';
import { calcDerived, STATS, type CoreStats } from '../stats/derived.ts';
import { rowOf } from './formation.ts';
import { bodyTier } from './rules.ts';
import type { BattleEntity, CombatGear, EntityKind, Side } from './types.ts';

// Builds battle entities. Everyone (players, creatures, NPCs, bosses) uses this shape.

export type CombatantSetup = {
  id: string;
  kind: EntityKind;
  side: Side;
  slot: number; // battle formation slot; the row follows
  speaker: string | null;
  grows: boolean;
  corrupted: boolean;
  controller: 'ai' | 'player';
  stats: CoreStats;
  bodyParts: string[];
  moves: { name: string; level: number }[];
  weaponType?: string | null;
  ammo?: Map<string, number>;
  resist?: Map<string, number>;
  gear?: CombatGear;
};

// No gear: bare hands, no armor.
export const emptyGear = (): CombatGear => ({
  weaponType: null, weapon: null, offHandType: null, offHand: null, punchPower: 0, kickPower: 0, defense: 0, coverage: {},
  armorPieces: [], statAdd: {}, triggers: [], wear: new Map(), thrownSpent: 0, ammo: [], ammoSpent: new Map(),
});

// Ammo the bag holds, by type (all arrows count, whatever the stack).
const ammoTotals = (gear: CombatGear): [string, number][] => {
  const out = new Map<string, number>();
  for (const a of gear.ammo) out.set(a.type, (out.get(a.type) ?? 0) + a.qty);
  return [...out];
};

export function createEntity(cfg: BalanceConfig, s: CombatantSetup): BattleEntity {
  const derived = calcDerived(s.stats, cfg.derived);
  const gear = s.gear ?? emptyGear();
  return {
    id: s.id,
    kind: s.kind,
    side: s.side,
    slot: s.slot,
    row: rowOf(cfg.formation, s.slot),
    speaker: s.speaker,
    grows: s.grows,
    corrupted: s.corrupted,
    controller: s.controller,
    stats: { ...s.stats },
    derived,
    bodyParts: [...s.bodyParts],
    weaponType: s.weaponType ?? gear.weaponType,
    ammo: new Map(s.ammo ?? ammoTotals(gear)),
    gear,
    moves: s.moves.map((m) => m.name),
    moveLevels: new Map(s.moves.map((m) => [m.name, m.level])),
    resist: new Map(s.resist ?? []),
    hp: derived.maxHp,
    stamina: derived.maxStamina,
    mana: derived.maxMana,
    atb: 0,
    phase: 'filling',
    timerMs: 0,
    action: null,
    queued: null,
    effects: [],
    tiers: {
      hp: bodyTier(cfg, 'hp', derived.maxHp, derived.maxHp),
      stamina: bodyTier(cfg, 'stamina', derived.maxStamina, derived.maxStamina),
      mana: bodyTier(cfg, 'mana', derived.maxMana, derived.maxMana),
    },
    immuneShown: new Set(),
    cooldowns: new Map(),
  };
}

// Fresh progress for a growing entity: stat exp and move exp start at zero.
export function createProgress(
  stats: CoreStats,
  moves: { name: string; level: number }[],
  recipes: string[] = [],
): Progress {
  const statProgress = Object.fromEntries(STATS.map((s) => [s, { base: stats[s], exp: 0 }]));
  return {
    stats: statProgress as Progress['stats'],
    moves: new Map(moves.map((m) => [m.name, { level: m.level, exp: 0 }])),
    recipes: new Set(recipes),
  };
}
