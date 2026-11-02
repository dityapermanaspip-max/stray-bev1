import type { BalanceConfig } from '../config/balance.ts';
import type { StockRow, Town } from '../data/economy_repo.ts';
import { buyPrice, capacityOf, safeQty, sellPrice, sellsFinished, tradeable } from '../economy/prices.ts';
import { addItem, removePiece, removeStack, stackKey, type Inventory, type Piece } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { carcassData, freshnessTier } from '../inventory/loot.ts';
import { addCoins, payCoins } from '../inventory/money.ts';

// The town shop. It sells from the town's stock at the stock price and buys at its share of that price,
// so what a town has plenty of is cheap to buy and fetches little to sell. Whatever it buys goes on its shelf.
// Villagers have a ceiling on what they will pay for one thing (max_buy) and a till that can run dry.
// The fill that sets a price counts every quality of the item together. The shelf holds finished goods only
// (gear, tools, craftsman-made): the raw catch it buys stays in its store. Taboo goods are never taken or stocked.
// It never sells below the villagers' safe stock.

export type Offer = { ref: string; item: string; qty: number; price: number }; // the player sells
export type Ware = { key: string; item: string; qty: number; price: number }; // the player buys
export type Trade = { deltas: StockRow[]; purseDelta: number; line: string };
// Standing moves prices for one player (a won haggle, the pushover mark, a generous trade): what they pay, what they get.
export type PriceAdjust = { buy: (price: number) => number; sell: (price: number) => number };
export const AS_IS: PriceAdjust = { buy: (p) => p, sell: (p) => p };

function held(town: Town, item: string): number {
  let n = 0;
  for (const row of town.stock.values()) if (row.item === item) n += row.qty;
  return n;
}

// What the town asks for one, at its current stock (or with `extra` more on the shelf).
export function townPrice(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, item: string, quality: string, extra = 0): number | null {
  const def = catalog.get(item);
  if (!def || !tradeable(cfg.economy, def, town.taboo)) return null;
  return sellPrice(cfg.economy, def, quality, held(town, item) + extra, capacityOf(cfg.economy, def, town.specialties));
}

// 0..1: wear for gear, freshness (and taint) for carcasses, whole for everything else. null = the shop refuses it.
function condition(cfg: BalanceConfig, catalog: ItemCatalog, piece: Piece | null, now: number): number | null {
  if (!piece) return 1;
  const carcass = carcassData(piece);
  if (carcass) {
    const b = cfg.loot.buyers;
    if (carcass.corrupted && !b.shopBuysCorrupted) return null;
    return (cfg.loot.rot.chanceMult[freshnessTier(cfg, carcass.killedAt, now) - 1] ?? 0) * (carcass.corrupted ? b.corruptedMult : 1);
  }
  const max = catalog.get(piece.item)?.maxDurability ?? 0;
  return max > 0 ? piece.durability / max : 1;
}

// The shop prices what it buys at the stock it will have once it holds it, so buying the last one and selling it
// straight back always loses (the empty-shelf price never leaks into what the shop pays).
function offerPrice(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, item: string, quality: string, piece: Piece | null, now: number) {
  const price = townPrice(cfg, catalog, town, item, quality, 1);
  const cond = condition(cfg, catalog, piece, now);
  return price === null || cond === null ? null : buyPrice(cfg.economy, price, cond);
}

// Everything in the bag the shop would look at (not what is worn). A price of 0 means it is worth nothing here.
export function shopOffers(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, inv: Inventory, now: number, adj = AS_IS): Offer[] {
  const out: Offer[] = [];
  for (const s of inv.stacks.values()) {
    const price = s.slot ? null : offerPrice(cfg, catalog, town, s.item, s.quality, null, now);
    if (price !== null) out.push({ ref: stackKey(s.item, s.quality), item: s.item, qty: s.qty, price: adj.sell(price) });
  }
  for (const p of inv.pieces) {
    const price = p.slot ? null : offerPrice(cfg, catalog, town, p.item, p.quality, p, now);
    if (price !== null) out.push({ ref: p.id, item: p.item, qty: 1, price: adj.sell(price) });
  }
  return out;
}

const onShelf = (cfg: BalanceConfig, catalog: ItemCatalog, crafted: ReadonlySet<string>, item: string) => {
  const def = catalog.get(item);
  return !!def && sellsFinished(cfg.economy, def, crafted);
};

// What is on the shelf. crafted: finished craftsman goods (made by a recipe, not an input of one).
// What of a stock row the shop may sell: above the villagers' safe stock (counted over all qualities of the item).
function spare(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, row: StockRow): number {
  const def = catalog.get(row.item);
  return def ? Math.max(0, Math.min(row.qty, held(town, row.item) - safeQty(cfg.economy, def, town.specialties))) : 0;
}

export function shopWares(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, crafted: ReadonlySet<string>, adj = AS_IS): Ware[] {
  return [...town.stock.values()]
    .filter((r) => onShelf(cfg, catalog, crafted, r.item))
    .flatMap((r) => {
      const qty = spare(cfg, catalog, town, r);
      const price = townPrice(cfg, catalog, town, r.item, r.quality);
      return price === null || qty < 1 ? [] : [{ key: stackKey(r.item, r.quality), item: r.item, qty, price: adj.buy(price) }];
    });
}

function shelve(town: Town, item: string, quality: string, qty: number): StockRow {
  const key = stackKey(item, quality);
  const row = town.stock.get(key) ?? { item, quality, qty: 0 };
  row.qty += qty;
  town.stock.set(key, row);
  return { item, quality, qty };
}

// The player sells one of something (a stack key or a piece id). Answers a line key on refusal.
export function sellToShop(cfg: BalanceConfig, catalog: ItemCatalog, town: Town, inv: Inventory, ref: string, now: number, adj = AS_IS): Trade | string {
  const stack = inv.stacks.get(ref);
  const piece = stack ? null : inv.pieces.find((p) => p.id === ref) ?? null;
  const thing = stack ?? piece;
  if (!thing || thing.slot) return 'town.shop.nothing';
  if (piece && carcassData(piece)?.corrupted && !cfg.loot.buyers.shopBuysCorrupted) return 'shop.refuse_corrupted';
  const offer = offerPrice(cfg, catalog, town, thing.item, thing.quality, piece, now);
  const price = offer === null ? null : adj.sell(offer);
  if (price === null || price <= 0) return 'town.shop.nothing';
  if (price > town.maxBuy) return 'town.shop.too_dear';
  if (price > town.purse) return 'town.shop.no_money';
  if (stack) removeStack(inv, ref, 1);
  else removePiece(inv, piece!.id);
  addCoins(cfg, catalog, inv, price);
  town.purse -= price;
  return { deltas: [shelve(town, thing.item, thing.quality, 1)], purseDelta: -price, line: 'town.shop.sold' };
}

// The player buys one off the shelf (a stock key).
export function buyFromShop(
  cfg: BalanceConfig, catalog: ItemCatalog, town: Town, inv: Inventory, key: string, crafted: ReadonlySet<string>, adj = AS_IS,
): Trade | string {
  const row = town.stock.get(key);
  if (!row || spare(cfg, catalog, town, row) < 1 || !onShelf(cfg, catalog, crafted, row.item)) return 'town.shop.out';
  const ask = townPrice(cfg, catalog, town, row.item, row.quality);
  if (ask === null) return 'town.shop.out';
  const price = adj.buy(ask);
  if (!payCoins(cfg, catalog, inv, price)) return 'town.shop.cannot_pay';
  addItem(catalog, inv, row.item, 1, undefined, row.quality);
  town.purse += price;
  return { deltas: [shelve(town, row.item, row.quality, -1)], purseDelta: price, line: 'town.shop.bought' };
}
