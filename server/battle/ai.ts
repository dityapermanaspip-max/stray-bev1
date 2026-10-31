import { pick } from '../util/rng.ts';
import type { BattleCore } from './core.ts';
import { HANDLERS } from './effects/registry.ts';
import { canUse, isAlive, validTargets } from './rules.ts';
import type { BattleEntity, MoveDef, PendingAction } from './types.ts';

// Simple battle AI, also used for headless runs and as the player default later.

export function usableMoves(core: BattleCore, entity: BattleEntity): MoveDef[] {
  if (core.isBound(entity)) return [];
  return entity.moves
    .map((name) => core.data.moves.get(name))
    .filter((m): m is MoveDef => !!m && canUse(core.cfg, entity, m))
    .filter((m) => m.effects.length > 0 && m.effects.every((f) => f.handler in HANDLERS))
    .filter((m) => validTargets(core.entities, entity, m).length > 0);
}

const targetsEnemies = (m: MoveDef) => ['one_enemy', 'enemy_row', 'all_enemies'].includes(m.target);
const heals = (m: MoveDef) => m.effects.some((f) => f.handler === 'heal_over_time');

export function chooseAction(core: BattleCore, entity: BattleEntity, healBelowTier: number): PendingAction | null {
  const moves = usableMoves(core, entity);
  if (moves.length === 0) return null;

  const hurt = core.entities
    .filter((e) => isAlive(e) && e.side === entity.side && e.tiers.hp <= healBelowTier)
    .sort((a, b) => a.hp / a.derived.maxHp - b.hp / b.derived.maxHp);
  const healMoves = moves.filter(heals);
  if (hurt.length > 0 && healMoves.length > 0) {
    const move = pick(core.rng, healMoves)!;
    const target = validTargets(core.entities, entity, move).includes(hurt[0]) ? hurt[0] : entity;
    return { move: move.name, targetIds: [target.id] };
  }

  const options = moves.filter((m) => !heals(m));
  const move = pick(core.rng, options.length > 0 ? options : moves)!;
  const valid = validTargets(core.entities, entity, move);
  const taunt = core.find(entity, 'taunt');
  const taunter = taunt && targetsEnemies(move) ? valid.find((e) => e.id === taunt.byId) : undefined;
  const target = taunter ?? pick(core.rng, valid)!;
  return { move: move.name, targetIds: [target.id] };
}
