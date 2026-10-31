import { randomUUID } from 'node:crypto';
import type { BalanceConfig } from '../config/balance.ts';
import { itemWeight, type ItemCatalog } from './items.ts';

// What an entity carries. Stackables are counted stacks; gear pieces are one row each with durability.
// Equipped things are still carried: they count toward the load.

export type Stack = { item: string; quality: string; qty: number; slot: string | null };
export type Piece = {
  id: string;
  item: string;
  durability: number;
  quality: string;
  slot: string | null;
  data: Record<string, unknown>; // hidden per-piece data, e.g. a carcass's species and kill time
};
export type Inventory = { stacks: Map<string, Stack>; pieces: Piece[]; known: Set<string> };
export type BagError = 'unknown_item' | 'bad_qty' | 'not_held';

export const emptyInventory = (): Inventory => ({ stacks: new Map(), pieces: [], known: new Set() });

const validQty = (qty: number) => Number.isInteger(qty) && qty > 0;

// Stacks are keyed by item and quality: two qualities never merge.
export const stackKey = (item: string, quality: string) => `${item}@${quality}`;

// Stacks of one item, any quality, best-filled first.
export const stacksOf = (inv: Inventory, item: string): Stack[] =>
  [...inv.stacks.values()].filter((s) => s.item === item).sort((a, b) => b.qty - a.qty);
export const countOf = (inv: Inventory, item: string): number => stacksOf(inv, item).reduce((n, s) => n + s.qty, 0);

// Adds qty of an item: a stack grows, or qty new pieces appear at full durability.
export function addItem(
  catalog: ItemCatalog,
  inv: Inventory,
  item: string,
  qty: number,
  newId: () => string = randomUUID,
  quality: string | null = null,
  data: Record<string, unknown> = {},
): BagError | null {
  const def = catalog.get(item);
  if (!def) return 'unknown_item';
  if (!validQty(qty)) return 'bad_qty';
  if (def.stack) {
    const q = quality ?? def.defaultQuality;
    const key = stackKey(item, q);
    const stack = inv.stacks.get(key) ?? { item, quality: q, qty: 0, slot: null };
    stack.qty += qty;
    inv.stacks.set(key, stack);
    return null;
  }
  for (let i = 0; i < qty; i++) {
    inv.pieces.push({
      id: newId(), item, durability: def.maxDurability ?? 0, quality: quality ?? def.defaultQuality, slot: null, data: { ...data },
    });
  }
  return null;
}

// Removes qty from one stack (by stack key).
export function removeStack(inv: Inventory, key: string, qty: number): BagError | null {
  const stack = inv.stacks.get(key);
  if (!validQty(qty)) return 'bad_qty';
  if (!stack || stack.qty < qty) return 'not_held';
  stack.qty -= qty;
  if (stack.qty === 0) inv.stacks.delete(key);
  return null;
}

// Removes qty of an item across its stacks, fullest stacks first.
export function removeItem(inv: Inventory, item: string, qty: number): BagError | null {
  if (!validQty(qty)) return 'bad_qty';
  if (countOf(inv, item) < qty) return 'not_held';
  let left = qty;
  for (const s of stacksOf(inv, item)) {
    const take = Math.min(left, s.qty);
    removeStack(inv, stackKey(s.item, s.quality), take);
    left -= take;
    if (left === 0) break;
  }
  return null;
}

export function removePiece(inv: Inventory, id: string): BagError | null {
  const index = inv.pieces.findIndex((p) => p.id === id);
  if (index < 0) return 'not_held';
  inv.pieces.splice(index, 1);
  return null;
}

export function carriedWeight(cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory): number {
  let total = 0;
  for (const s of inv.stacks.values()) total += itemWeight(cfg, catalog.get(s.item)!) * s.qty;
  for (const p of inv.pieces) total += itemWeight(cfg, catalog.get(p.item)!);
  return total;
}

// 1 light, 2 carrying, 3 slowed (weight_limits.slow_at), 4 stuck (weight_limits.stuck_at).
export const LOAD_TIERS = 4;
export function loadTier(cfg: BalanceConfig, weight: number, maxWeight: number): number {
  const share = maxWeight > 0 ? weight / maxWeight : Infinity;
  const { slow_at, stuck_at } = cfg.gear.weightLimits;
  return 1 + [cfg.gear.loadLightBelow, slow_at, stuck_at].filter((t) => share >= t).length;
}

// 0 broken, then 1 (worst) to 4 (good) by gear_condition_tiers.
export function conditionTier(cfg: BalanceConfig, durability: number, maxDurability: number): number {
  if (durability <= 0 || maxDurability <= 0) return 0;
  const share = durability / maxDurability;
  return 1 + cfg.gear.conditionTiers.filter((t) => share >= t).length;
}

// How well a piece still works: 1 new, falling to wear_floor just before it breaks, 0 broken.
export function wearFactor(cfg: BalanceConfig, durability: number, maxDurability: number): number {
  if (durability <= 0 || maxDurability <= 0) return 0;
  const share = Math.min(1, durability / maxDurability);
  return cfg.gear.wearFloor + (1 - cfg.gear.wearFloor) * share;
}

// Same effect from several pieces: strongest counts fully, each next one counts falloff times less.
export function stackedValue(cfg: BalanceConfig, values: number[]): number {
  return [...values].sort((a, b) => b - a).reduce((sum, v, i) => sum + v * cfg.gear.stackFalloff ** i, 0);
}
