import type { StandingConfig } from '../config/standing_config.ts';
import { hexDistance } from '../world/world_hour.ts';

// Standing rules (hidden). Favor is personal (one NPC), fame is per town, and charm counts toward both at a gate.
// Nothing here reaches the client: the door view only learns which options are open and which line to say.

// What the server knows about a player and one NPC at one town, for this visit.
export type Standing = {
  favor: number;
  fame: number; // the player's fame in this town
  charm: number;
  pushover: boolean; // marked as a pushover by this NPC (until it fades)
  haggle: 'open' | 'won' | 'spent'; // this visit: not tried yet, won, or tried and lost
};

// 0 stranger, 1 known, 2 friend, 3 trusted (as many tiers as the config lists).
export const favorTier = (cfg: StandingConfig, favor: number) => cfg.favorTiers.filter((t) => favor >= t).length;

// A talk option is open when favor and fame (each helped by charm) reach its gate. Unknown options stay closed.
export function optionOpen(cfg: StandingConfig, option: string, s: Standing): boolean {
  const gate = cfg.options[option];
  if (!gate) return false;
  return favorTier(cfg, s.favor + s.charm * cfg.charmFavor) >= gate.favorTier && s.fame + s.charm * cfg.charmFame >= gate.fame;
}

// The haggle button shows when the option is open and this visit's try is not used yet.
export const canHaggle = (cfg: StandingConfig, s: Standing) => s.haggle === 'open' && optionOpen(cfg, 'haggle', s);

// Chance a haggle works, in per-mille: charm raises it, being a pushover lowers it, clamped to the config range.
export function haggleChance(cfg: StandingConfig, charm: number, pushover: boolean): number {
  const h = cfg.haggle;
  const raw = h.basePermille + charm * h.charmPermille - (pushover ? cfg.pushover.hagglePermille : 0);
  return Math.max(h.minPermille, Math.min(h.maxPermille, raw));
}

// Multipliers on what the player pays (buy) and gets (sell) with this NPC: a won haggle helps for the visit,
// the pushover mark hurts until it fades.
export type PriceMods = { buy: number; sell: number };
export const NO_MODS: PriceMods = { buy: 1, sell: 1 };

export function priceMods(cfg: StandingConfig, s: Standing): PriceMods {
  let buy = 1, sell = 1;
  if (s.haggle === 'won') { buy *= 1 - cfg.haggle.margin; sell *= 1 + cfg.haggle.margin; }
  if (s.pushover) { buy *= 1 + cfg.pushover.priceMargin; sell *= 1 - cfg.pushover.priceMargin; }
  return { buy, sell };
}

// Whole copper, ignoring float dust (100 x 1.1 is 110, not 111).
const up = (x: number) => Math.ceil(x - 1e-9);
const down = (x: number) => Math.floor(x + 1e-9);

// Prices after mods: the player never pays less than 1, and the shop pays whole copper.
export const modBuy = (price: number, m: PriceMods) => Math.max(1, up(price * m.buy));
export const modSell = (price: number, m: PriceMods) => Math.max(0, down(price * m.sell));

// A generous trade: pay over or take under the price by the margin.
export const generousBuy = (cfg: StandingConfig, price: number) => up(price * (1 + cfg.generous.margin));
export const generousSell = (cfg: StandingConfig, price: number) => down(price * (1 - cfg.generous.margin));

// Generosity earns favor only while favor (charm does not count) is under the cap tier; past it, the NPC
// takes the player for a pushover.
export const generousOutcome = (cfg: StandingConfig, favor: number): 'favor' | 'pushover' =>
  favorTier(cfg, favor) < cfg.generous.capTier ? 'favor' : 'pushover';

// Fame from one deed at `from`: full in a town on that hex, falling off per hex, none past the radius.
export type TownHex = { ref: string; q: number; r: number };
export function fameShares(cfg: StandingConfig, from: { q: number; r: number }, towns: TownHex[], amount: number): { ref: string; amount: number }[] {
  return towns.flatMap((t) => {
    const d = hexDistance(from, t);
    return d > cfg.fame.radius ? [] : [{ ref: t.ref, amount: amount * cfg.fame.falloff ** d }];
  });
}
