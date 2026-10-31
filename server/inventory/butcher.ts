import type { MoveDef } from '../battle/types.ts';
import type { BalanceConfig } from '../config/balance.ts';
import { addMoveExp, type GrowthEvent, type Progress } from '../growth/level_up.ts';
import { rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import { addItem, removePiece, type Inventory } from './bag.ts';
import { itemWeight, type ItemCatalog } from './items.ts';
import { carcassData, freshnessTier, rollLoot, type Drop, type LootData } from './loot.ts';
import { addCoins, payCoins } from './money.ts';

// What can happen to a carcass:
// - sell it whole: any shop pays a little (corrupted ones may be refused), the butcher pays more;
// - "gamble": the butcher cuts it up for a coin fee, or keeps a share of the parts as payment;
// - butcher it yourself (or a party member does) with the butchery skill and a blade: no fee, skill exp.

export type ButcherMode = 'npc_pay' | 'npc_cut' | 'self';
export type Buyer = 'shop' | 'butcher';
export type ButcherError = 'not_held' | 'not_carcass' | 'cannot_pay' | 'no_skill' | 'no_tool' | 'refused';
export type Cutter = { progress: Progress; inv: Inventory; luck: number }; // whoever holds the knife
export type ButcherResult = { drops: Drop[]; kept: Drop[]; fee: number; lines: string[]; growth: GrowthEvent[] };

export type ButcherJob = {
  cfg: BalanceConfig;
  catalog: ItemCatalog;
  loot: LootData;
  moves: Map<string, MoveDef>;
  inv: Inventory; // whose carcass it is; the parts land here
  pieceId: string;
  mode: ButcherMode;
  cutter: Cutter | null; // for mode self: the owner or a party member
  now: number;
  rng: Rng;
};

function findCarcass(inv: Inventory, pieceId: string) {
  const piece = inv.pieces.find((p) => p.id === pieceId);
  if (!piece) return { error: 'not_held' as const };
  const data = carcassData(piece);
  return data ? { piece, data } : { error: 'not_carcass' as const };
}

const hasBlade = (cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory) =>
  [...inv.pieces, ...inv.stacks.values()].some((x) => {
    const type = catalog.get(x.item)?.wield?.weaponType;
    return type !== undefined && cfg.loot.butchery.toolTypes.includes(type);
  });

const worthless = (catalog: ItemCatalog, drops: Drop[]) => drops.every((d) => (catalog.get(d.item)?.value ?? 0) === 0);

export function butcherCarcass(job: ButcherJob): ButcherError | ButcherResult {
  const { cfg, catalog, inv, mode, rng } = job;
  const b = cfg.loot.butchery;
  const found = findCarcass(inv, job.pieceId);
  if ('error' in found) return found.error!;
  const { piece, data } = found;

  let level = b.npcLevel;
  let luck = b.npcLuck; // the town butcher cuts with their own luck
  let fee = 0;
  if (mode === 'self') {
    const known = job.cutter?.progress.moves.get(b.move);
    if (!job.cutter || !known) return 'no_skill';
    if (!hasBlade(cfg, catalog, job.cutter.inv)) return 'no_tool';
    level = known.level;
    luck = job.cutter.luck;
  } else if (mode === 'npc_pay') {
    fee = Math.ceil(itemWeight(cfg, catalog.get(piece.item)!) * b.feePerWeight);
    if (!payCoins(cfg, catalog, inv, fee)) return 'cannot_pay';
  }

  const rolled = rollLoot(cfg, catalog, job.loot, data, level, luck, job.now, rng);
  const kept: Drop[] = [];
  const drops: Drop[] = [];
  for (const d of rolled) {
    let cut = 0;
    if (mode === 'npc_cut') for (let i = 0; i < d.qty; i++) if (rollPermille(rng, b.cutSharePermille)) cut++;
    if (cut > 0) kept.push({ ...d, qty: cut });
    if (d.qty - cut > 0) drops.push({ ...d, qty: d.qty - cut });
  }
  removePiece(inv, piece.id);
  for (const d of drops) addItem(catalog, inv, d.item, d.qty, undefined, d.quality);

  let growth: GrowthEvent[] = [];
  if (mode === 'self') {
    const move = job.moves.get(b.move);
    if (move) growth = addMoveExp(job.cutter!.progress, b.move, b.expPerCarcass, { statExp: move.statExp, expScaling: move.expScaling }, cfg);
  }
  const lines = [mode === 'self' ? 'butcher.self' : mode === 'npc_pay' ? 'butcher.paid' : 'butcher.cut'];
  if (worthless(catalog, drops)) lines.push('butcher.junk');
  return { drops, kept, fee, lines, growth };
}

// Whole-carcass price in copper: value x buyer rate x freshness, less for corrupted. Shops may refuse corrupted.
export function carcassPrice(cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory, pieceId: string, buyer: Buyer, now: number): ButcherError | number {
  const found = findCarcass(inv, pieceId);
  if ('error' in found) return found.error!;
  const { piece, data } = found;
  const buyers = cfg.loot.buyers;
  if (data.corrupted && buyer === 'shop' && !buyers.shopBuysCorrupted) return 'refused';
  const tier = freshnessTier(cfg, data.killedAt, now);
  const rate = (buyer === 'shop' ? buyers.shop : buyers.butcher) * (data.corrupted ? buyers.corruptedMult : 1);
  return Math.floor((catalog.get(piece.item)?.value ?? 0) * rate * (cfg.loot.rot.chanceMult[tier - 1] ?? 0));
}

export function sellCarcass(
  cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory, pieceId: string, buyer: Buyer, now: number,
): ButcherError | { price: number; lines: string[] } {
  const price = carcassPrice(cfg, catalog, inv, pieceId, buyer, now);
  if (typeof price === 'string') return price;
  removePiece(inv, pieceId);
  addCoins(cfg, catalog, inv, price);
  return { price, lines: [buyer === 'shop' ? 'shop.bought' : 'butcher.bought'] };
}

// Every line pool the loot flow speaks from (checked at startup).
export const LOOT_LINE_KEYS = [
  'loot.carcass.take', 'loot.carcass.left', 'butcher.paid', 'butcher.cut', 'butcher.self', 'butcher.junk',
  'butcher.cannot_pay', 'butcher.no_tool', 'butcher.no_skill', 'butcher.bought', 'shop.bought', 'shop.refuse_corrupted',
];

// Line key for a refusal, so the client hears a sentence instead of an error code.
export const refusalLine = (error: ButcherError) =>
  error === 'refused' ? 'shop.refuse_corrupted' : error === 'cannot_pay' ? 'butcher.cannot_pay'
    : error === 'no_tool' ? 'butcher.no_tool' : error === 'no_skill' ? 'butcher.no_skill' : null;
