import type { BalanceConfig } from '../config/balance.ts';
import type { Craft } from '../data/economy_repo.ts';
import { craftFee } from '../economy/prices.ts';
import { addItem, countOf, removeItem, type Inventory } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { coinTotal, payCoins } from '../inventory/money.ts';

// Town craftsmen (cook, woodworker, ...): bring the inputs, pay a fee, take the output.
// The fee is a share of the base value the work adds, so it never depends on the town's stock.

export type Recipe = { name: string; output: string; outputQty: number; inputs: { item: string; qty: number; have: number }[]; fee: number };

const valueOf = (catalog: ItemCatalog, item: string) => catalog.get(item)?.value ?? 0;

export function feeFor(cfg: BalanceConfig, catalog: ItemCatalog, craft: Craft): number {
  const input = craft.inputs.reduce((sum, x) => sum + valueOf(catalog, x.item) * x.qty, 0);
  return craftFee(cfg.economy, input, valueOf(catalog, craft.output) * craft.outputQty);
}

export function recipesOf(cfg: BalanceConfig, catalog: ItemCatalog, crafts: Craft[], craftsman: string, inv: Inventory): Recipe[] {
  return crafts.filter((c) => c.craftsman === craftsman).map((c) => ({
    name: c.name, output: c.output, outputQty: c.outputQty, fee: feeFor(cfg, catalog, c),
    inputs: c.inputs.map((x) => ({ item: x.item, qty: x.qty, have: countOf(inv, x.item) })),
  }));
}

// Makes one batch. Answers the fee paid, or a line key on refusal.
export function craftOnce(cfg: BalanceConfig, catalog: ItemCatalog, craft: Craft, inv: Inventory): { fee: number; line: string } | string {
  if (craft.inputs.some((x) => countOf(inv, x.item) < x.qty)) return 'town.craft.missing';
  const fee = feeFor(cfg, catalog, craft);
  if (coinTotal(cfg, inv) < fee) return 'town.craft.cannot_pay';
  for (const x of craft.inputs) removeItem(inv, x.item, x.qty);
  payCoins(cfg, catalog, inv, fee);
  addItem(catalog, inv, craft.output, craft.outputQty);
  return { fee, line: 'town.craft.done' };
}
