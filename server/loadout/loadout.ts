import type { BalanceConfig } from '../config/balance.ts';
import type { MoveDef } from '../battle/types.ts';
import type { Progress } from '../growth/level_up.ts';

// Equipped moves: slot number -> move name. Known moves are unlimited; only equipped ones are usable in battle.
// Life skills (category life) are learned and levelled like any move but never go in a slot.

export type Loadout = Map<number, string>;
export type SwapPlace = { inTown: boolean; inBattle: boolean };
export type LoadoutError = 'in_battle' | 'not_in_town' | 'bad_slot' | 'unknown_move' | 'not_slottable';

export const LIFE_CATEGORY = 'life';

export const slottable = (moves: ReadonlyMap<string, Pick<MoveDef, 'category'>>, move: string) =>
  moves.has(move) && moves.get(move)!.category !== LIFE_CATEGORY;

export function canSwap(cfg: BalanceConfig, place: SwapPlace): LoadoutError | null {
  if (place.inBattle) return 'in_battle';
  if (!place.inTown && !cfg.loadoutSwapAnywhere) return 'not_in_town';
  return null;
}

const validSlot = (cfg: BalanceConfig, slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= cfg.loadoutSlots;

// Puts a known move in a slot. If the move sits in another slot, the two slots trade places.
export function equip(
  cfg: BalanceConfig,
  loadout: Loadout,
  progress: Progress,
  moves: ReadonlyMap<string, Pick<MoveDef, 'category'>>,
  slot: number,
  move: string,
  place: SwapPlace,
): LoadoutError | null {
  const blocked = canSwap(cfg, place);
  if (blocked) return blocked;
  if (!validSlot(cfg, slot)) return 'bad_slot';
  if (!progress.moves.has(move)) return 'unknown_move';
  if (!slottable(moves, move)) return 'not_slottable';

  const from = slotOf(loadout, move);
  const current = loadout.get(slot);
  if (from !== null) {
    loadout.delete(from);
    if (current !== undefined) loadout.set(from, current);
  }
  loadout.set(slot, move);
  return null;
}

export function unequip(cfg: BalanceConfig, loadout: Loadout, slot: number, place: SwapPlace): LoadoutError | null {
  const blocked = canSwap(cfg, place);
  if (blocked) return blocked;
  if (!validSlot(cfg, slot)) return 'bad_slot';
  loadout.delete(slot);
  return null;
}

export function slotOf(loadout: Loadout, move: string): number | null {
  for (const [slot, name] of loadout) if (name === move) return slot;
  return null;
}

export function firstFreeSlot(cfg: BalanceConfig, loadout: Loadout): number | null {
  for (let slot = 1; slot <= cfg.loadoutSlots; slot++) if (!loadout.has(slot)) return slot;
  return null;
}

// Equipped moves in slot order.
export function equippedMoves(loadout: Loadout): string[] {
  return [...loadout].sort((a, b) => a[0] - b[0]).map(([, move]) => move);
}

// A new entity's moves fill the first slots in order.
export function starterLoadout(cfg: BalanceConfig, moves: string[]): Loadout {
  return new Map(moves.slice(0, cfg.loadoutSlots).map((move, i) => [i + 1, move]));
}
