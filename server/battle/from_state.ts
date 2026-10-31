import type { BalanceConfig } from '../config/balance.ts';
import type { BodyNow } from '../data/entity_load.ts';
import { progressStats, type Progress } from '../growth/level_up.ts';
import { equippedMoves, type Loadout } from '../loadout/loadout.ts';
import { createEntity } from './factory.ts';
import { bodyTier } from './rules.ts';
import type { BattleEntity, CombatGear, Row, Side } from './types.ts';

// Turns a saved, growing entity into a combatant. Only equipped moves come into battle.

export type GrowerSetup = {
  id: string;
  kind: BattleEntity['kind'];
  side: Side;
  row: Row;
  speaker: string;
  controller: 'ai' | 'player';
  progress: Progress;
  loadout: Loadout;
  bodyParts: string[];
  body: BodyNow | null;
  gear?: CombatGear;
};

export function growerEntity(cfg: BalanceConfig, s: GrowerSetup): BattleEntity {
  const entity = createEntity(cfg, {
    id: s.id,
    kind: s.kind,
    side: s.side,
    row: s.row,
    speaker: s.speaker,
    grows: true,
    corrupted: false,
    controller: s.controller,
    stats: progressStats(s.progress),
    bodyParts: s.bodyParts,
    gear: s.gear,
    moves: equippedMoves(s.loadout).flatMap((name) => {
      const known = s.progress.moves.get(name);
      return known ? [{ name, level: known.level }] : [];
    }),
  });
  if (s.body) applyBody(cfg, entity, s.body);
  return entity;
}

// Carried-over pools, capped by the current maximums.
export function applyBody(cfg: BalanceConfig, e: BattleEntity, body: BodyNow): void {
  e.hp = Math.min(body.hp, e.derived.maxHp);
  e.stamina = Math.min(body.stamina, e.derived.maxStamina);
  e.mana = Math.min(body.mana, e.derived.maxMana);
  e.tiers = {
    hp: bodyTier(cfg, 'hp', e.hp, e.derived.maxHp),
    stamina: bodyTier(cfg, 'stamina', e.stamina, e.derived.maxStamina),
    mana: bodyTier(cfg, 'mana', e.mana, e.derived.maxMana),
  };
}

export const bodyOf = (e: BattleEntity): BodyNow => ({ hp: e.hp, stamina: e.stamina, mana: e.mana });
