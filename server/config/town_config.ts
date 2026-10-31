// Typed view of the town economy, town tick and world clock keys of balance_config. Hidden: server only.

// Town trade. A town's price for an item follows its stock: price_empty_mult x base when out, base at half its
// capacity, price_full_mult x base when full. The shop buys at buy_share of its own selling price.
export type EconomyConfig = {
  emptyMult: number; fullMult: number; buyShare: number;
  shopSellsTypes: string[]; // item types on the shop shelf besides craftsman-made goods
  capacity: Record<string, number>; // item type -> stock capacity in a plain town (types missing here are not traded)
  specialtyMult: number; // capacity x this for a town's specialty goods
  startFill: number; specialtyFill: number; // share of capacity a new town starts with
  safeFill: number; specialtySafeFill: number; // share of capacity the villagers keep: the shop never sells below it
  qualityValue: Record<string, number>; // price x this per quality
  craftFeeShare: number; craftMinFee: number; // craftsman fee: share of the value added, at least the minimum
};

// One town tick, from the settlement's population: villagers use goods from the store per 100 people and pay for them;
// the workforce (a share of the population, spread over jobs by the town's job shares) brings goods in from the hexes
// within reach and is paid from the purse; town craftsmen turn stock into finished goods. Per-tick amounts;
// fractions round by chance. Common jobs (farmer, laborer, guard) feed the village themselves: no store goods, no wage.
export type TownTickConfig = {
  intervalHours: number; // world hours between town ticks
  reach: number; // hexes away (axial distance) that hunters and woodcutters work
  consumePer100: Record<string, number>; // item type -> store goods 100 villagers use per tick (all items of the type, at base price)
  workforceShare: number; // share of the population that works
  villagerPayShare: number; // villagers pay this share of the town price for what they use (into the purse)
  maxFill: number; // stock never grows past capacity x this; the rest is wasted
  hunt: { perWorker: number }; // creatures caught per hunter per tick at full density (fractions add up over workers)
  wood: { perWorker: number; item: string; terrain: string; fullShare: number }; // logs per woodcutter per tick in a full forest (tree share of tiles >= full_share)
  craft: { perWorker: number }; // batches per craftsman worker per tick (fractions add up over workers)
  wages: Record<string, number>; // job -> copper per worker per tick (store-supplying jobs); unpaid workers do not work
};

// The world clock: how often the server checks for due world hours, and how many it catches up after a stop.
export type ClockConfig = { checkSeconds: number; catchUpHours: number };

type RawEconomy = {
  price_empty_mult: number; price_full_mult: number; shop_buy_share: number; shop_sells_types: string[]; capacity: Record<string, number>;
  specialty: { capacity_mult: number; start_fill: number; safe_fill: number }; start_fill: number; safe_fill: number;
  quality_value: Record<string, number>; craft: { fee_share: number; min_fee: number };
};

export function economyConfig(e: RawEconomy): EconomyConfig {
  return {
    emptyMult: e.price_empty_mult, fullMult: e.price_full_mult, buyShare: e.shop_buy_share, shopSellsTypes: e.shop_sells_types, capacity: e.capacity,
    specialtyMult: e.specialty.capacity_mult, startFill: e.start_fill, specialtyFill: e.specialty.start_fill,
    safeFill: e.safe_fill, specialtySafeFill: e.specialty.safe_fill,
    qualityValue: e.quality_value, craftFeeShare: e.craft.fee_share, craftMinFee: e.craft.min_fee,
  };
}

type RawTownTick = {
  interval_hours: number; reach: number; consume_per_100: Record<string, number>; workforce_share: number; villager_pay_share: number; max_fill: number;
  hunt: { per_worker: number }; wood: { per_worker: number; item: string; terrain: string; full_share: number }; craft: { per_worker: number };
  wages: Record<string, number>;
};

export function townTickConfig(t: RawTownTick): TownTickConfig {
  return {
    intervalHours: t.interval_hours, reach: t.reach, consumePer100: t.consume_per_100, workforceShare: t.workforce_share,
    villagerPayShare: t.villager_pay_share, maxFill: t.max_fill,
    hunt: { perWorker: t.hunt.per_worker }, wood: { perWorker: t.wood.per_worker, item: t.wood.item, terrain: t.wood.terrain, fullShare: t.wood.full_share },
    craft: { perWorker: t.craft.per_worker }, wages: t.wages,
  };
}

export const clockConfig = (c: { check_seconds: number; catch_up_hours: number }): ClockConfig => ({
  checkSeconds: c.check_seconds, catchUpHours: c.catch_up_hours,
});
