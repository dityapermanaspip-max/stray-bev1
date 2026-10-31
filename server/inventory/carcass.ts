import { randomUUID } from 'node:crypto';
import type { BalanceConfig } from '../config/balance.ts';
import { addItem, carriedWeight, type Inventory } from './bag.ts';
import { itemWeight, type ItemCatalog } from './items.ts';
import type { CarcassData } from './loot.ts';

// A kill leaves a heavy carcass. The party shares one pool: each carcass goes to whoever has the most
// spare weight below the stuck limit. Nobody can carry it: it stays where it fell (a field corpse).

export type Taker = { id: string; inv: Inventory; maxWeight: number };
export type Shared = { taken: { takerId: string; item: string }[]; left: CarcassData[] };

export function carcassItem(catalog: ItemCatalog, species: string): string | null {
  for (const def of catalog.values()) if (def.carcassOf === species) return def.name;
  return null;
}

export const carcassPieceData = (c: CarcassData) => ({
  species: c.species, corrupted: c.corrupted, total_stats: c.totalStats, killed_at: c.killedAt,
});

export function shareCarcasses(
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  takers: Taker[],
  carcasses: CarcassData[],
  newId: () => string = randomUUID,
): Shared {
  const out: Shared = { taken: [], left: [] };
  const limit = cfg.gear.weightLimits.stuck_at;
  const weighed = carcasses.map((c) => {
    const item = carcassItem(catalog, c.species);
    return { c, item, weight: item ? itemWeight(cfg, catalog.get(item)!) : Infinity };
  });
  for (const { c, item, weight } of weighed.sort((a, b) => b.weight - a.weight)) {
    const spare = (t: Taker) => t.maxWeight * limit - carriedWeight(cfg, catalog, t.inv);
    const best = item ? [...takers].sort((a, b) => spare(b) - spare(a))[0] : undefined;
    if (!item || !best || spare(best) < weight) {
      out.left.push(c);
      continue;
    }
    addItem(catalog, best.inv, item, 1, newId, null, carcassPieceData(c));
    out.taken.push({ takerId: best.id, item });
  }
  return out;
}
