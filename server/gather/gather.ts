import type { EncounterConfig } from '../config/balance.ts';
import type { GatherConfig, NodeKind } from '../config/gather_config.ts';
import type { Inventory } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LootEntry } from '../inventory/loot.ts';
import { goodChance, rollPermille, type LuckConfig } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import { groupLimit, type Foe } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';

// Working a resource node (pure). A fitting tool must be in the bag: a weapon type or a tool type the node kind
// lists; a bonus tool finds more. Each loot entry rolls on its own: permille x skill x tool bonus, plus luck.
// Hidden numbers only; the client hears a line and sees what was found.

export type Find = { item: string; qty: number };

// The best fitting tool carried: its find multiplier (bonusMult for a bonus tool, else 1), or null with none.
export function toolMult(kind: NodeKind, catalog: ItemCatalog, inv: Inventory): number | null {
  let best: number | null = null;
  for (const x of [...inv.pieces, ...inv.stacks.values()]) {
    const def = catalog.get(x.item);
    const type = def?.toolType ?? def?.wield?.weaponType;
    if (!type || !kind.tools.includes(type)) continue;
    best = Math.max(best ?? 1, kind.bonusTools.includes(type) ? kind.bonusMult : 1);
  }
  return best;
}

export function rollFinds(
  cfg: GatherConfig, luckCfg: LuckConfig, entries: LootEntry[], level: number, mult: number, luck: number, rng: Rng,
): Find[] {
  const skill = cfg.chanceBase + cfg.chancePerLevel * level;
  const finds: Find[] = [];
  for (const e of entries) {
    if (!rollPermille(rng, goodChance(luckCfg, e.permille * skill * mult, luck))) continue;
    finds.push({ item: e.item, qty: e.min + Math.floor(rng() * (e.max - e.min + 1)) });
  }
  return finds;
}

// Corrupted creatures that guard a dark node: species by their corrupted head count, group size by density.
export function guards(cfg: EncounterConfig, rows: PopRow[], rng: Rng, cap: number): Foe[] {
  const dark = rows.filter((r) => r.corrupted > 0);
  const total = dark.reduce((s, r) => s + r.corrupted, 0);
  if (total <= 0) return [];
  const size = 1 + Math.floor(rng() * groupLimit(cfg, rows, cap));
  return Array.from({ length: size }, () => {
    let roll = rng() * total;
    const r = dark.find((x) => (roll -= x.corrupted) < 0) ?? dark[dark.length - 1];
    return { species: r.species, corrupted: true };
  });
}
