import type { BalanceConfig } from '../config/balance.ts';
import { addItem, countOf, removeItem, type Inventory } from './bag.ts';
import type { ItemCatalog } from './items.ts';

// Coins are ordinary stacked items with weight. Values in copper come from config (coin_values).
// Money is one of the numbers the client may see.

const byValue = (cfg: BalanceConfig) => Object.entries(cfg.loot.coins).sort((a, b) => b[1] - a[1]);

export function coinTotal(cfg: BalanceConfig, inv: Inventory): number {
  return byValue(cfg).reduce((sum, [coin, value]) => sum + countOf(inv, coin) * value, 0);
}

// Pays in the largest coins that fit, highest first.
export function addCoins(cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory, copper: number): void {
  let left = Math.max(0, Math.floor(copper));
  for (const [coin, value] of byValue(cfg)) {
    const n = Math.floor(left / value);
    if (n > 0 && addItem(catalog, inv, coin, n) === null) left -= n * value;
  }
}

// Takes the amount, smallest coins first; change for a broken larger coin comes back in smaller coins.
export function payCoins(cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory, copper: number): boolean {
  const amount = Math.max(0, Math.ceil(copper));
  if (coinTotal(cfg, inv) < amount) return false;
  let owed = amount;
  for (const [coin, value] of [...byValue(cfg)].reverse()) {
    if (owed <= 0) break;
    const held = countOf(inv, coin);
    const use = Math.min(held, Math.ceil(owed / value));
    if (use === 0) continue;
    removeItem(inv, coin, use);
    owed -= use * value;
  }
  if (owed < 0) addCoins(cfg, catalog, inv, -owed);
  return true;
}
