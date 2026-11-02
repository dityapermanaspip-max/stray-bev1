import type { EconomyConfig } from '../config/balance.ts';
import type { ItemDef } from '../inventory/items.ts';

// Town prices. Every item has a base price; a town sells it at base when its stock sits at half capacity,
// dearer when stock runs low, cheaper when it piles up. The shop buys at a share of its own selling price,
// so whatever a town has plenty of also fetches little there. A town keeps much more of its specialty goods
// (bigger capacity, started fuller): they are cheap there, and one sale barely moves their price.

// taboo: what this town's folk refuse (its culture): item types, shapes or goods families (elves: meat, carcasses).
export const tradeable = (cfg: EconomyConfig, item: ItemDef, taboo: readonly string[] = []) =>
  item.value > 0 && !item.taboo && cfg.capacity[item.type] !== undefined &&
  !taboo.some((t) => t === item.type || t === item.shape || item.goods.includes(t));

// The shop shelf holds finished goods only: gear and tools (shop_sells types) and whatever a craftsman makes.
// Raw catch and materials it buys sit in its store for the craftsmen; bring your own to have something made.
export const sellsFinished = (cfg: EconomyConfig, item: ItemDef, crafted: ReadonlySet<string>) =>
  cfg.shopSellsTypes.includes(item.type) || crafted.has(item.name);

export const isSpecialty = (item: ItemDef, specialties: readonly string[]) => item.goods.some((g) => specialties.includes(g));

export function capacityOf(cfg: EconomyConfig, item: ItemDef, specialties: readonly string[]): number {
  return Math.max(1, Math.round((cfg.capacity[item.type] ?? 0) * (isSpecialty(item, specialties) ? cfg.specialtyMult : 1)));
}

// What the villagers keep of an item: the shop never sells below it (consumption may still eat into it).
export function safeQty(cfg: EconomyConfig, item: ItemDef, specialties: readonly string[]): number {
  return Math.round(capacityOf(cfg, item, specialties) * (isSpecialty(item, specialties) ? cfg.specialtySafeFill : cfg.safeFill));
}

// What a new town keeps of an item.
export function startQty(cfg: EconomyConfig, item: ItemDef, specialties: readonly string[]): number {
  return Math.round(capacityOf(cfg, item, specialties) * (isSpecialty(item, specialties) ? cfg.specialtyFill : cfg.startFill));
}

// Price multiplier by fill: empty_mult at 0, 1 at half, full_mult at full (and beyond), straight lines between.
export function stockMult(cfg: EconomyConfig, qty: number, capacity: number): number {
  const fill = Math.min(1, Math.max(0, qty / Math.max(1, capacity)));
  return fill <= 0.5 ? cfg.emptyMult + (1 - cfg.emptyMult) * (fill / 0.5) : 1 + (cfg.fullMult - 1) * ((fill - 0.5) / 0.5);
}

// What the town asks for one, at its current stock. Never below one copper.
export function sellPrice(cfg: EconomyConfig, item: ItemDef, quality: string, qty: number, capacity: number): number {
  return Math.max(1, Math.round(item.value * (cfg.qualityValue[quality] ?? 1) * stockMult(cfg, qty, capacity)));
}

// What the shop pays for one: its share of its own price, times the item's condition (wear, freshness).
export function buyPrice(cfg: EconomyConfig, townPrice: number, condition = 1): number {
  return Math.floor(townPrice * cfg.buyShare * Math.max(0, Math.min(1, condition)));
}

// A craftsman's fee: a share of the value the work adds (base prices), at least the minimum.
export function craftFee(cfg: EconomyConfig, inputValue: number, outputValue: number): number {
  return Math.max(cfg.craftMinFee, Math.ceil(Math.max(0, outputValue - inputValue) * cfg.craftFeeShare));
}
