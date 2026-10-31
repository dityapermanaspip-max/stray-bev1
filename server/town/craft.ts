import type { BalanceConfig } from '../config/balance.ts';
import type { ItemQty, Recipe } from '../data/economy_repo.ts';
import { craftFee } from '../economy/prices.ts';
import { addItem, countOf, removeItem, type Inventory } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { coinTotal, payCoins } from '../inventory/money.ts';

// Town craftsmen (cook, woodworker, tanner, ...): bring the inputs, pay a fee, take the outputs. A craftsman makes
// the recipes of their facility up to their level in this town. Outputs can feed other recipes (pelt -> hide ->
// leather -> jerkin). The fee is a share of the base value the work adds, so it never depends on the town's stock.

export type RecipeView = { name: string; outputs: ItemQty[]; inputs: (ItemQty & { have: number })[]; fee: number };

const valueOf = (catalog: ItemCatalog, xs: ItemQty[]) => xs.reduce((sum, x) => sum + (catalog.get(x.item)?.value ?? 0) * x.qty, 0);

export const feeFor = (cfg: BalanceConfig, catalog: ItemCatalog, r: Recipe) => craftFee(cfg.economy, valueOf(catalog, r.inputs), valueOf(catalog, r.outputs));

// What this craftsman makes at their level.
export const recipesAt = (recipes: Recipe[], facility: string, level: number) => recipes.filter((r) => r.facility === facility && r.level <= level);

export function recipeViews(cfg: BalanceConfig, catalog: ItemCatalog, recipes: Recipe[], inv: Inventory): RecipeView[] {
  return recipes.map((r) => ({
    name: r.name, outputs: r.outputs, fee: feeFor(cfg, catalog, r),
    inputs: r.inputs.map((x) => ({ ...x, have: countOf(inv, x.item) })),
  }));
}

// Makes one batch. Answers the fee paid, or a line key on refusal.
export function craftOnce(cfg: BalanceConfig, catalog: ItemCatalog, r: Recipe, inv: Inventory): { fee: number; line: string } | string {
  if (r.inputs.some((x) => countOf(inv, x.item) < x.qty)) return 'town.craft.missing';
  const fee = feeFor(cfg, catalog, r);
  if (coinTotal(cfg, inv) < fee) return 'town.craft.cannot_pay';
  for (const x of r.inputs) removeItem(inv, x.item, x.qty);
  payCoins(cfg, catalog, inv, fee);
  for (const x of r.outputs) addItem(catalog, inv, x.item, x.qty);
  return { fee, line: 'town.craft.done' };
}
