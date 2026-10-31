import { loadTown, saveTrade, type Town } from '../data/economy_repo.ts';
import { saveBag, saveBodyAndBag } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { SERVICE_NAME_PREFIX } from '../db/startup_check.ts';
import { ITEM_NAME_PREFIX } from '../inventory/bag_view.ts';
import type { Inventory } from '../inventory/bag.ts';
import { coinTotal, payCoins } from '../inventory/money.ts';
import type { Rng } from '../util/rng.ts';
import type { ServiceRequest, ServiceView } from '../../shared/town.ts';
import type { GameWorld } from '../game/world.ts';
import { craftOnce, recipesOf } from './craft.ts';
import { buyFromShop, sellToShop, shopOffers, shopWares } from './shop.ts';

// Town doors. Standing on a door opens its service; the client then asks for actions there.
// Inn: pay copper, wake rested. Shop: buys and sells against the town's stock. Craftsmen: any service with recipes.
// Temple, guild and trainer are closed until their steps. The town's stock and purse are read fresh for every
// view and action (the DB is the truth; two players may trade at once).

export type DoorCtx = { world: GameWorld; rng: Rng; ref: string };

const say = (c: DoorCtx, key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;
const nameOf = (c: DoorCtx, item: string) => c.world.data.lines.pick(c.rng, ITEM_NAME_PREFIX + item)?.text ?? item;
const isCraftsman = (c: DoorCtx, service: string) => c.world.crafts.some((x) => x.craftsman === service);
const townOf = (c: DoorCtx) => loadTown(c.world.pool, c.world.data.cfg.economy, c.world.catalog, c.ref);

function shopView(c: DoorCtx, town: Town, inv: Inventory): NonNullable<ServiceView['shop']> {
  const { cfg } = c.world.data;
  const named = <T extends { item: string }>(xs: T[]) => xs.map(({ item, ...rest }) => ({ ...rest, name: nameOf(c, item) }));
  return { offers: named(shopOffers(cfg, c.world.catalog, town, inv, Date.now())), wares: named(shopWares(cfg, c.world.catalog, town)) };
}

function craftView(c: DoorCtx, service: string, inv: Inventory): NonNullable<ServiceView['craft']> {
  const recipes = recipesOf(c.world.data.cfg, c.world.catalog, c.world.crafts, service, inv);
  return {
    recipes: recipes.map((r) => ({
      name: r.name, output: nameOf(c, r.output), qty: r.outputQty, fee: r.fee,
      inputs: r.inputs.map((x) => ({ name: nameOf(c, x.item), qty: x.qty, have: x.have })),
    })),
  };
}

function view(c: DoorCtx, service: string, inv: Inventory, town: Town | null, text: string | null): ServiceView {
  const { cfg } = c.world.data;
  const shop = service === 'shop' && town ? shopView(c, town, inv) : null;
  const craft = isCraftsman(c, service) ? craftView(c, service, inv) : null;
  const open = service === 'inn' || shop !== null || craft !== null;
  return {
    service,
    name: c.world.data.lines.pick(c.rng, SERVICE_NAME_PREFIX + service)?.text ?? service,
    text: text ?? (open ? null : say(c, 'town.closed')),
    inn: service === 'inn' ? { price: cfg.town.innPrice } : null,
    shop,
    craft,
    purse: coinTotal(cfg, inv),
  };
}

export async function openService(c: DoorCtx, entityId: string, service: string): Promise<ServiceView> {
  const [inv, town] = await Promise.all([loadInventory(c.world.pool, entityId), service === 'shop' ? townOf(c) : null]);
  return view(c, service, inv, town, null);
}

// One action at the door the player stands on. Answers with the refreshed door view.
export async function useService(c: DoorCtx, entityId: string, service: string, req: ServiceRequest): Promise<ServiceView> {
  const { cfg } = c.world.data;
  const { catalog, pool } = c.world;
  const inv = await loadInventory(pool, entityId);
  if (service === 'inn' && req?.action === 'rest') {
    if (!payCoins(cfg, catalog, inv, cfg.town.innPrice)) return view(c, service, inv, null, say(c, 'town.inn.no_money'));
    await saveBodyAndBag(pool, entityId, null, inv);
    return view(c, service, inv, null, say(c, 'town.inn.rested'));
  }
  if (service === 'shop' && (req?.action === 'sell' || req?.action === 'buy')) {
    const town = await townOf(c);
    if (!town) return view(c, service, inv, null, null);
    const done = req.action === 'sell'
      ? sellToShop(cfg, catalog, town, inv, String(req.ref ?? ''), Date.now())
      : buyFromShop(cfg, catalog, town, inv, String(req.key ?? ''));
    if (typeof done === 'string') return view(c, service, inv, town, say(c, done));
    await saveTrade(pool, entityId, inv, town.ref, done.deltas, done.purseDelta);
    return view(c, service, inv, town, say(c, done.line));
  }
  const craft = req?.action === 'craft' ? c.world.crafts.find((x) => x.craftsman === service && x.name === req.name) : undefined;
  if (craft) {
    const done = craftOnce(cfg, catalog, craft, inv);
    if (typeof done === 'string') return view(c, service, inv, null, say(c, done));
    // The fee goes to the town's purse when the town keeps one.
    const town = await townOf(c);
    if (town) await saveTrade(pool, entityId, inv, town.ref, [], done.fee);
    else await saveBag(pool, entityId, inv);
    return view(c, service, inv, null, say(c, done.line));
  }
  return view(c, service, inv, null, null);
}
