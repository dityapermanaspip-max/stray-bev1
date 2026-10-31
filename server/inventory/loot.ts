import type { BalanceConfig } from '../config/balance.ts';
import { goodChance, rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import { stackKey, type Piece } from './bag.ts';
import type { ItemCatalog } from './items.ts';

// Loot is rolled when a carcass is butchered, from its species' natural or corrupted loot table.
// Freshness comes from the kill time (no timer). Skill raises drop chances and part quality;
// rot lowers both. Essence only comes from corrupted tables; its quality comes from the creature's strength.
// Chances are out of 1000; the cutter's luck adds flat per-mille to each drop and to the part quality nudge.

export type LootEntry = { item: string; permille: number; min: number; max: number };
export type SpeciesLoot = { native: LootEntry[]; corrupted: LootEntry[] };
export type EssenceTier = { quality: string; minTotal: number; item: string };
export type LootData = { bySpecies: Map<string, SpeciesLoot>; essence: EssenceTier[] };
export type CarcassData = { species: string; corrupted: boolean; totalStats: number; killedAt: number };
export type Drop = { item: string; qty: number; quality: string };

const HOUR_MS = 3_600_000;

export function carcassData(p: Piece): CarcassData | null {
  const d = p.data;
  if (typeof d.species !== 'string') return null;
  return { species: d.species, corrupted: d.corrupted === true, totalStats: Number(d.total_stats ?? 0), killedAt: Number(d.killed_at ?? 0) };
}

// 1 fresh, 2 aging, 3 spoiling, 4 rotten. Hours are real hours times world_time_scale.
export function freshnessTier(cfg: BalanceConfig, killedAt: number, now: number): number {
  const hours = (now - killedAt) / HOUR_MS;
  return 1 + cfg.loot.rot.hours.filter((h) => hours >= h * cfg.worldTimeScale).length;
}

// Skill level to drop chance multiplier and quality steps above common.
export function butcherSkill(cfg: BalanceConfig, level: number): { chanceMult: number; qualitySteps: number } {
  const b = cfg.loot.butchery;
  return { chanceMult: b.chanceBase + b.chancePerLevel * level, qualitySteps: b.qualityUpAt.filter((l) => level >= l).length };
}

export function essenceQuality(loot: LootData, item: string, totalStats: number): string | null {
  const tiers = loot.essence.filter((t) => t.item === item);
  if (tiers.length === 0) return null;
  return tiers.filter((t) => totalStats >= t.minTotal).sort((a, b) => b.minTotal - a.minTotal)[0]?.quality ?? tiers[0].quality;
}

function stepQuality(cfg: BalanceConfig, steps: number): string {
  const ladder = cfg.loot.qualityLadder;
  const base = Math.max(0, ladder.indexOf('common'));
  return ladder[Math.max(0, Math.min(ladder.length - 1, base + steps))];
}

export function rollLoot(
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  loot: LootData,
  carcass: CarcassData,
  skillLevel: number,
  luck: number,
  now: number,
  rng: Rng,
): Drop[] {
  const table = loot.bySpecies.get(carcass.species);
  if (!table) return [];
  const tier = freshnessTier(cfg, carcass.killedAt, now);
  const rotMult = cfg.loot.rot.chanceMult[tier - 1] ?? 0;
  const skill = butcherSkill(cfg, skillLevel);
  const partSteps = skill.qualitySteps - (cfg.loot.rot.qualityDrop[tier - 1] ?? 0);
  const nudge = goodChance(cfg.luck, cfg.loot.qualityNudgePermille, luck);
  const rotten = tier >= cfg.loot.rot.hours.length + 1;

  const drops = new Map<string, Drop>();
  for (const entry of carcass.corrupted ? table.corrupted : table.native) {
    const essence = essenceQuality(loot, entry.item, carcass.totalStats);
    const base = entry.permille * rotMult * (essence ? 1 : skill.chanceMult);
    if (!rollPermille(rng, goodChance(cfg.luck, base, luck))) continue;
    const qty = entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
    const rotsTo = rotten ? catalog.get(entry.item)?.rotsTo : null;
    const item = rotsTo ?? entry.item;
    const quality = essence ?? stepQuality(cfg, partSteps + (rollPermille(rng, nudge) ? 1 : 0));
    const key = stackKey(item, quality);
    const drop = drops.get(key) ?? { item, qty: 0, quality };
    drop.qty += qty;
    drops.set(key, drop);
  }
  return [...drops.values()];
}
