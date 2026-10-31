import type pg from 'pg';
import type { StandingConfig } from '../config/standing_config.ts';
import { loadEntityState } from '../data/entity_load.ts';
import type { GameWorld } from '../game/world.ts';
import { progressStats } from '../growth/level_up.ts';
import type { PriceAdjust } from '../town/shop.ts';
import { rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import {
  canHaggle, favorTier, generousBuy, generousOutcome, generousSell, haggleChance, modBuy, modSell, priceMods, type Standing,
} from './standing.ts';
import { addFavor, keeperFor, loadStanding, markPushover, recordHaggle } from './standing_repo.ts';

// The shop door and standing: the shopkeeper's greeting by favor tier, the one haggle per visit, generous trades
// (favor up to a cap, then the pushover mark), and the prices that follow. Only lines and option flags leave here.

export type ShopTalk = { keeperId: string; s: Standing };

export async function shopTalk(world: GameWorld, entityId: string, townRef: string): Promise<ShopTalk> {
  const [keeperId, state] = await Promise.all([keeperFor(world.pool, townRef, 'shop'), loadEntityState(world.pool, entityId)]);
  const charm = progressStats(state.progress).charm;
  return { keeperId, s: await loadStanding(world.pool, entityId, keeperId, townRef, charm) };
}

// Greeting tier: favor alone (charm opens doors, it does not make a stranger a friend).
export const greetTier = (cfg: StandingConfig, t: ShopTalk) => favorTier(cfg, t.s.favor);
export const haggleOpen = (cfg: StandingConfig, t: ShopTalk) => canHaggle(cfg, t.s);

// Prices for this player at this shop. Generous applies on top of the price they are shown.
export function shopAdjust(cfg: StandingConfig, t: ShopTalk, generous = false): PriceAdjust {
  const m = priceMods(cfg, t.s);
  return {
    buy: (p) => (generous ? generousBuy(cfg, modBuy(p, m)) : modBuy(p, m)),
    sell: (p) => (generous ? generousSell(cfg, modSell(p, m)) : modSell(p, m)),
  };
}

// The one haggle of the visit. Answers the line key, or null when the keeper will not haggle now.
export async function haggle(world: GameWorld, rng: Rng, entityId: string, townRef: string, t: ShopTalk): Promise<string | null> {
  const cfg = world.data.cfg.standing;
  if (!canHaggle(cfg, t.s)) return null;
  const won = rollPermille(rng, haggleChance(cfg, t.s.charm, t.s.pushover));
  await recordHaggle(world.pool, cfg, entityId, t.keeperId, townRef, won);
  return won ? 'town.shop.haggle_won' : 'town.shop.haggle_lost';
}

// After a generous trade: favor while under the cap, otherwise the pushover mark. Runs inside the trade's transaction.
export function generousEffect(world: GameWorld, entityId: string, t: ShopTalk): { line: string; write: (db: pg.PoolClient) => Promise<void> } {
  const { cfg } = world.data;
  if (generousOutcome(cfg.standing, t.s.favor) === 'favor') {
    return { line: 'town.shop.generous', write: (db) => addFavor(db, entityId, t.keeperId, cfg.standing.generous.favor) };
  }
  return { line: 'town.shop.pushover', write: (db) => markPushover(db, cfg, entityId, t.keeperId) };
}
