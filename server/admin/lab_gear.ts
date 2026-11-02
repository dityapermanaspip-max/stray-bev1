import { defenseReduction } from '../battle/damage.ts';
import type { BattleEntity } from '../battle/types.ts';
import type { BalanceConfig } from '../config/balance.ts';
import type { Progress } from '../growth/level_up.ts';
import { addItem, carriedWeight, emptyInventory, loadTier, stackKey, type Inventory } from '../inventory/bag.ts';
import { equipGear, type GearRef } from '../inventory/gear.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LabFighter, LabGearInfo } from './lab_types.ts';

// Sandbox bags for lab fighters, and the hidden gear numbers the lab shows. Admin only.

const ANYWHERE = { inTown: true, inBattle: false };
const MAX_QTY = 99;

// Gives each listed item, then equips the ones with a slot (gear rules apply; refusals are errors).
export function labInventory(
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  f: LabFighter,
  progress: Progress,
  where: string,
): { inventory: Inventory; error: string | null } {
  const inventory = emptyInventory();
  let n = 0;
  for (const g of f.gear ?? []) {
    const qty = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(g.qty) || 1)));
    const firstNew = inventory.pieces.length;
    const error = addItem(catalog, inventory, g.item, qty, () => `${where}-${++n}`);
    if (error) return { inventory, error: `${where}: ${g.item} ${error}` };
    if (!g.slot) continue;
    const def = catalog.get(g.item)!;
    const ref: GearRef = def.stack ? { stack: stackKey(g.item, def.defaultQuality) } : { piece: inventory.pieces[firstNew].id };
    const change = equipGear(cfg, catalog, inventory, progress, ref, ANYWHERE, g.slot, true); // lab fighters may dual wield
    if (typeof change === 'string') return { inventory, error: `${where}: ${g.item} to ${g.slot} refused (${change})` };
  }
  return { inventory, error: null };
}

export function gearInfo(cfg: BalanceConfig, catalog: ItemCatalog, e: BattleEntity, inv: Inventory): LabGearInfo {
  const g = e.gear;
  const weight = carriedWeight(cfg, catalog, inv);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    weaponType: g.weaponType,
    weaponPower: round(g.weapon?.power ?? 0),
    weaponAccuracy: g.weapon?.accuracy ?? 1,
    vsArmor: g.weapon?.vsArmor ?? {},
    punchPower: round(g.punchPower),
    kickPower: round(g.kickPower),
    defense: round(g.defense),
    reduction: round(defenseReduction(cfg.combat, g.defense)),
    coverage: Object.fromEntries(Object.entries(g.coverage).map(([k, v]) => [k, round(v)])),
    statAdd: Object.fromEntries(Object.entries(g.statAdd).map(([k, v]) => [k, round(v ?? 0)])),
    weight: round(weight),
    maxWeight: e.derived.maxInventoryWeight,
    loadTier: loadTier(cfg, weight, e.derived.maxInventoryWeight),
    thrownLeft: g.weapon?.thrownItem ? g.weapon.thrownLeft : null,
  };
}

// Durability lost per piece and throws spent during the fight.
export function gearWear(inv: Inventory, e: BattleEntity): { item: string; lost: number }[] {
  const out = [...e.gear.wear].map(([id, lost]) => ({ item: inv.pieces.find((p) => p.id === id)?.item ?? id, lost }));
  if (e.gear.thrownSpent > 0) out.push({ item: `${e.gear.weapon?.thrownItem} thrown`, lost: e.gear.thrownSpent });
  return out;
}
