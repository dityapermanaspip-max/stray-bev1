import type { BattleEntity, Row } from './types.ts';

// Battle formation (config battle.formation). Each side has `front` + `back` slots, numbered front first
// (1..front, then front+1..front+back); the slot decides the row, which is never stored. A party holds at most
// party_max, an enemy side at most enemy_max. Melee reaches the front row first and cannot be used from the back.
// Knockback pushes a front target into the back slot behind it; when that slot is taken, both take collision
// damage (knockback_blocked_share of the hit, at least the minimum damage) and nobody moves.

export type FormationConfig = { front: number; back: number; partyMax: number; enemyMax: number; knockbackBlockedShare: number };

export function formationConfig(r: { front: number; back: number; party_max: number; enemy_max: number; knockback_blocked_share: number }): FormationConfig {
  return { front: r.front, back: r.back, partyMax: r.party_max, enemyMax: r.enemy_max, knockbackBlockedShare: r.knockback_blocked_share };
}

export const slotCount = (f: FormationConfig) => f.front + f.back;
export const isSlot = (f: FormationConfig, slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= slotCount(f);
export const rowOf = (f: FormationConfig, slot: number): Row => (slot <= f.front ? 'front' : 'back');

// Moves an entity to a slot (its row follows). The only place a fighter's slot changes.
export function setSlot(f: FormationConfig, e: BattleEntity, slot: number): void {
  e.slot = slot;
  e.row = rowOf(f, slot);
}

// The back slot behind a front slot: the front row spread evenly over the back row (4 over 3: 1->5, 2->6, 3->6, 4->7).
export function slotBehind(f: FormationConfig, slot: number): number | null {
  if (rowOf(f, slot) !== 'front' || f.back < 1) return null;
  const step = f.front > 1 ? (slot - 1) * (f.back - 1) / (f.front - 1) : 0;
  return f.front + 1 + Math.round(step);
}

// Slots for an encounter's foes, in order: the front row first, then the back. Foes past the last slot are dropped.
export function placeFoes(f: FormationConfig, count: number): number[] {
  return Array.from({ length: Math.min(count, f.enemyMax, slotCount(f)) }, (_, i) => i + 1);
}

export function findFormationProblems(f: FormationConfig): string[] {
  const out: string[] = [];
  if (!(f.front >= 1) || !(f.back >= 0)) out.push('battle.formation: front must be 1 or more, back 0 or more');
  if (!(f.partyMax >= 1) || f.partyMax > slotCount(f)) out.push('battle.formation: party_max must fit the slots');
  if (!(f.enemyMax >= 1) || f.enemyMax > slotCount(f)) out.push('battle.formation: enemy_max must fit the slots');
  if (!(f.knockbackBlockedShare >= 0)) out.push('battle.formation: knockback_blocked_share must be 0 or more');
  return out;
}
