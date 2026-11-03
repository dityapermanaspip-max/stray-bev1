import { facilityLevel, loadTown, saveTrade, type Town } from '../data/economy_repo.ts';
import { saveBag, saveBodyAndBag } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { SERVICE_NAME_PREFIX } from '../db/startup_check.ts';
import { ITEM_NAME_PREFIX } from '../inventory/bag_view.ts';
import type { Inventory } from '../inventory/bag.ts';
import { coinTotal, payCoins } from '../inventory/money.ts';
import type { Rng } from '../util/rng.ts';
import type { ServiceRequest, ServiceView } from '../../shared/town.ts';
import type { GameWorld } from '../game/world.ts';
import { craftOnce, recipeViews, recipesAt } from './craft.ts';
import { generousEffect, greetTier, haggle, haggleOpen, shopAdjust, shopContact, shopRefused, shopTalk, type ShopTalk } from '../standing/shop_standing.ts';
import { buyFromShop, sellToShop, shopOffers, shopWares } from './shop.ts';

// Town doors. Standing on a door opens its service; the client then asks for actions there.
// Inn: pay copper, wake rested. Shop: buys anything it trades, sells finished goods, against the town's stock.
// Craftsmen: any service with recipes, making what their level in this town allows.
// The shopkeeper's standing (favor, the visit's haggle, the pushover mark) moves this player's prices there.
// Temple, guild and trainer are closed until their steps. The town's stock and purse are read fresh for every
// view and action (the DB is the truth; two players may trade at once).

// rested: called when a rest worked (a camp or cave may then bring creatures).
export type DoorCtx = { world: GameWorld; rng: Rng; ref: string; rested?: () => void };

const say = (c: DoorCtx, key: string, tier = 0) => c.world.data.lines.pick(c.rng, key, tier, 'self')?.text ?? null;
const nameOf = (c: DoorCtx, item: string) => c.world.data.lines.pick(c.rng, ITEM_NAME_PREFIX + item)?.text ?? item;
const isCraftsman = (c: DoorCtx, service: string) => c.world.recipes.some((r) => r.facility === service);
const recipesHere = (c: DoorCtx, service: string, town: Town | null) => recipesAt(c.world.recipes, service, facilityLevel(town, service));
// What a night costs here, in copper: the inn's price, a camp's or cave's, or null when the door has no beds.
const restPrice = (c: DoorCtx, service: string): number | null =>
  service === 'inn' ? c.world.data.cfg.town.innPrice : c.world.data.cfg.interior.wild[service]?.restPrice ?? null;
const townOf = (c: DoorCtx) => loadTown(c.world.pool, c.world.data.cfg.economy, c.world.catalog, c.ref);

function shopView(c: DoorCtx, town: Town, inv: Inventory, talk: ShopTalk): NonNullable<ServiceView['shop']> {
  const { cfg } = c.world.data;
  const adj = shopAdjust(cfg.standing, talk);
  const named = <T extends { item: string }>(xs: T[]) => xs.map(({ item, ...rest }) => ({ ...rest, name: nameOf(c, item) }));
  return {
    offers: named(shopOffers(cfg, c.world.catalog, town, inv, Date.now(), adj)),
    wares: named(shopWares(cfg, c.world.catalog, town, c.world.crafted, adj)),
    haggle: haggleOpen(cfg.standing, talk),
  };
}

function craftView(c: DoorCtx, service: string, town: Town | null, inv: Inventory): NonNullable<ServiceView['craft']> {
  const recipes = recipeViews(c.world.data.cfg, c.world.catalog, recipesHere(c, service, town), inv);
  return {
    recipes: recipes.map((r) => ({
      name: r.name, fee: r.fee,
      outputs: r.outputs.map((x) => ({ name: nameOf(c, x.item), qty: x.qty })),
      inputs: r.inputs.map((x) => ({ name: nameOf(c, x.item), qty: x.qty, have: x.have })),
    })),
  };
}

function view(c: DoorCtx, service: string, inv: Inventory, town: Town | null, text: string | null, talk: ShopTalk | null = null): ServiceView {
  const { cfg } = c.world.data;
  const shop = service === 'shop' && town && talk ? shopView(c, town, inv, talk) : null;
  const craft = isCraftsman(c, service) ? craftView(c, service, town, inv) : null;
  const open = restPrice(c, service) !== null || shop !== null || craft !== null;
  return {
    service,
    name: c.world.data.lines.pick(c.rng, SERVICE_NAME_PREFIX + service)?.text ?? service,
    text: text ?? (open ? null : say(c, 'town.closed')),
    inn: restPrice(c, service) === null ? null : { price: restPrice(c, service)! },
    shop,
    craft,
    purse: coinTotal(cfg, inv),
  };
}

export async function openService(c: DoorCtx, entityId: string, service: string): Promise<ServiceView> {
  const [inv, town] = await Promise.all([loadInventory(c.world.pool, entityId), service === 'shop' || isCraftsman(c, service) ? townOf(c) : null]);
  if (service !== 'shop' || !town) return view(c, service, inv, town, null);
  const talk = await shopTalk(c.world, entityId, c.ref, c.rng);
  if (shopRefused(c.world.data.cfg.standing, talk)) return view(c, service, inv, town, say(c, 'town.shop.refuse'));
  await shopContact(c.world, entityId, talk);
  return view(c, service, inv, town, say(c, 'town.shop.greet', greetTier(c.world.data.cfg.standing, talk)), talk);
}

// One action at the door the player stands on. Answers with the refreshed door view.
export async function useService(c: DoorCtx, entityId: string, service: string, req: ServiceRequest): Promise<ServiceView> {
  const { cfg } = c.world.data;
  const { catalog, pool } = c.world;
  const inv = await loadInventory(pool, entityId);
  const price = restPrice(c, service);
  if (price !== null && req?.action === 'rest') {
    if (!payCoins(cfg, catalog, inv, price)) return view(c, service, inv, null, say(c, 'town.inn.no_money'));
    await saveBodyAndBag(pool, entityId, null, inv);
    c.rested?.();
    return view(c, service, inv, null, say(c, service === 'inn' ? 'town.inn.rested' : 'wild.rested'));
  }
  if (service === 'shop' && (req?.action === 'sell' || req?.action === 'buy' || req?.action === 'haggle')) {
    const town = await townOf(c);
    if (!town) return view(c, service, inv, null, null);
    const talk = await shopTalk(c.world, entityId, c.ref, c.rng);
    if (shopRefused(cfg.standing, talk)) return view(c, service, inv, town, say(c, 'town.shop.refuse'));
    const again = async (line: string | null) => view(c, service, inv, town, line && say(c, line), await shopTalk(c.world, entityId, c.ref, c.rng));
    if (req.action === 'haggle') return again(await haggle(c.world, c.rng, entityId, c.ref, talk));
    const generous = req.generous === true;
    const adj = shopAdjust(cfg.standing, talk, generous);
    const done = req.action === 'sell'
      ? sellToShop(cfg, catalog, town, inv, String(req.ref ?? ''), Date.now(), adj)
      : buyFromShop(cfg, catalog, town, inv, String(req.key ?? ''), c.world.crafted, adj);
    if (typeof done === 'string') return view(c, service, inv, town, say(c, done), talk);
    const effect = generous ? generousEffect(c.world, entityId, talk) : null;
    await saveTrade(pool, entityId, inv, town.ref, done.deltas, done.purseDelta, effect?.write);
    await shopContact(c.world, entityId, talk);
    return again(effect?.line ?? done.line);
  }
  if (req?.action === 'craft' && isCraftsman(c, service)) {
    const town = await townOf(c);
    const recipe = recipesHere(c, service, town).find((r) => r.name === req.name);
    if (!recipe) return view(c, service, inv, town, null);
    const done = craftOnce(cfg, catalog, recipe, inv);
    if (typeof done === 'string') return view(c, service, inv, town, say(c, done));
    // The fee goes to the town's purse when the town keeps one.
    if (town) await saveTrade(pool, entityId, inv, town.ref, [], done.fee);
    else await saveBag(pool, entityId, inv);
    return view(c, service, inv, town, say(c, done.line));
  }
  return view(c, service, inv, null, null);
}
