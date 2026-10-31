import { createProgress } from '../battle/factory.ts';
import type { BattleEntity } from '../battle/types.ts';
import { addItem, emptyInventory, type Inventory } from '../inventory/bag.ts';
import { butcherCarcass, carcassPrice, type ButcherResult } from '../inventory/butcher.ts';
import { carcassItem, carcassPieceData, shareCarcasses } from '../inventory/carcass.ts';
import { itemWeight } from '../inventory/items.ts';
import { freshnessTier, type CarcassData } from '../inventory/loot.ts';
import { createRng } from '../util/rng.ts';
import type { LabWorld } from './lab_battle.ts';
import type { LabButcherRequest, LabButcherResult, LabCarcasses } from './lab_types.ts';

// Loot in the lab: who carries which carcass after a win, and a butcher roll preview. Dev tool, numbers allowed.

const HOUR_MS = 3_600_000;
const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const totalStats = (e: BattleEntity) => Object.values(e.stats).reduce((a, b) => a + b, 0);

// The party shares one pool; the bags are lab copies, so nothing is saved.
export function labCarcasses(
  world: LabWorld, entities: BattleEntity[], bags: Map<string, Inventory>, speciesOf: Map<string, string>, labels: Map<string, string>,
): LabCarcasses {
  const kills: CarcassData[] = entities
    .filter((e) => e.side === 'enemy' && e.hp <= 0 && speciesOf.has(e.id))
    .map((e) => ({ species: speciesOf.get(e.id)!, corrupted: e.corrupted, totalStats: totalStats(e), killedAt: 0 }));
  const takers = entities
    .filter((e) => e.side === 'party' && e.hp > 0)
    .map((e) => ({ id: e.id, inv: bags.get(e.id)!, maxWeight: e.derived.maxInventoryWeight }));
  const shared = shareCarcasses(world.data.cfg, world.catalog, takers, kills);
  return {
    taken: shared.taken.map((t) => ({ by: labels.get(t.takerId) ?? t.takerId, item: t.item })),
    left: shared.left.map((c) => `${c.corrupted ? 'corrupted ' : ''}${c.species}`),
  };
}

// Butchers the same carcass many times and reports how often each drop came out.
export function butcherPreview(world: LabWorld, req: LabButcherRequest): LabButcherResult | string {
  const { cfg } = world.data;
  const def = world.species.get(String(req.species));
  if (!def) return `unknown species ${req.species}`;
  const item = carcassItem(world.catalog, def.name);
  if (!item) return `${def.name} has no carcass item`;
  const corrupted = !!req.corrupted;
  const hours = clamp(req.hours, 0, 10_000, 0);
  const level = clamp(req.level, 1, cfg.moveLevelCap, cfg.loot.butchery.npcLevel);
  const luck = clamp(req.luck, 0, 999, cfg.loot.butchery.npcLuck);
  const rolls = Math.floor(clamp(req.rolls, 1, 5000, 500));
  const data: CarcassData = {
    species: def.name, corrupted, totalStats: Object.values(def.baseStats).reduce((a, b) => a + b, 0), killedAt: 0,
  };
  const now = hours * HOUR_MS;
  const rng = createRng(Math.floor(clamp(req.seed, 0, 2 ** 31, 1)));
  const fresh = () => {
    const inv = emptyInventory();
    addItem(world.catalog, inv, item, 1, () => 'lab', null, carcassPieceData(data));
    return inv;
  };

  const knife = blade(world);
  const seen = new Map<string, { item: string; quality: string; times: number; qty: number }>();
  let junk = 0;
  for (let i = 0; i < rolls; i++) {
    const inv = fresh();
    const result = butcherCarcass({
      cfg, catalog: world.catalog, loot: world.loot, moves: world.data.moves, inv, pieceId: 'lab', mode: 'self',
      cutter: { progress: createProgress(def.baseStats, [{ name: cfg.loot.butchery.move, level }]), inv: knife, luck },
      now, rng,
    }) as ButcherResult;
    if (typeof result === 'string') return `butcher failed: ${result}`;
    if (result.lines.includes('butcher.junk')) junk++;
    for (const d of result.drops) {
      const key = `${d.item}@${d.quality}`;
      const s = seen.get(key) ?? { item: d.item, quality: d.quality, times: 0, qty: 0 };
      s.times++;
      s.qty += d.qty;
      seen.set(key, s);
    }
  }
  const price = (buyer: 'shop' | 'butcher') => {
    const p = carcassPrice(cfg, world.catalog, fresh(), 'lab', buyer, now);
    return typeof p === 'number' ? p : null;
  };
  return {
    carcass: item,
    totalStats: data.totalStats,
    freshness: freshnessTier(cfg, 0, now),
    rolls,
    junkShare: junk / rolls,
    drops: [...seen.values()]
      .map((s) => ({ item: s.item, quality: s.quality, share: s.times / rolls, avgQty: s.qty / s.times, value: world.catalog.get(s.item)?.value ?? 0 }))
      .sort((a, b) => b.share - a.share),
    fee: Math.ceil(itemWeight(cfg, world.catalog.get(item)!) * cfg.loot.butchery.feePerWeight),
    priceShop: price('shop'),
    priceButcher: price('butcher'),
  };
}

// A lab-only knife so the preview never fails on the tool check.
function blade(world: LabWorld): Inventory {
  const inv = emptyInventory();
  const knife = [...world.catalog.values()].find((d) => d.wield && world.data.cfg.loot.butchery.toolTypes.includes(d.wield.weaponType));
  if (knife) addItem(world.catalog, inv, knife.name, 1, () => 'knife');
  return inv;
}
