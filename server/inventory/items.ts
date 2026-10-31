import type { EffectDef } from '../battle/types.ts';
import type { BalanceConfig } from '../config/balance.ts';

// Item definitions read from item.items + item.materials. One row = one shape plus one core material.
// Armor defense and weight come from the material's full-set values times the slot's body share.

export type Wield = {
  weaponType: string;
  power: number;
  accuracy: number;
  hands: 1 | 2;
  thrown: boolean;
  vsArmor: Record<string, number>; // armor material tag -> damage bonus at full coverage
  grantsMove: string | null;
};

export type Worn = { slot: string; armor: boolean; punchPower: number; kickPower: number };
export type ItemTrigger = 'worn' | 'on_hit' | 'on_struck' | 'on_dodge' | 'used';
export type ItemEffect = { trigger: ItemTrigger; effect: EffectDef };

export type MaterialDef = {
  name: string;
  tags: string[];
  setDefense: number;
  setWeight: number;
  durability: number | null;
};

export type ItemDef = {
  name: string;
  type: string;
  shape: string | null;
  material: MaterialDef | null;
  weight: number | null; // null = from the material (armor)
  maxDurability: number | null; // null for stacks and for pieces that are not gear (carcasses)
  defaultQuality: string;
  stack: boolean; // stacks have no instances; pieces are one row each (gear, carcasses)
  value: number; // base copper price (a town at half stock sells at this); 0 = worthless
  goods: string[]; // trade families for town specialties (wood, chicken, ...)
  edible: boolean | null; // null = not food
  rotsTo: string | null; // what this becomes when its carcass was rotten
  carcassOf: string | null; // species this carcass came from
  wield: Wield | null;
  worn: Worn | null;
  effects: ItemEffect[]; // item.item_effects, in position order
};

export type ItemCatalog = Map<string, ItemDef>;

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' ? (v as Raw) : null);

export function parseMaterial(name: string, tags: string[], data: Raw): MaterialDef {
  return {
    name,
    tags,
    setDefense: Number(data.set_defense ?? 0),
    setWeight: Number(data.set_weight ?? 0),
    durability: data.durability === undefined ? null : Number(data.durability),
  };
}

export function parseItem(
  name: string,
  type: string,
  shape: string | null,
  material: MaterialDef | null,
  data: Raw,
  effects: ItemEffect[] = [],
): ItemDef {
  const w = obj(data.wield);
  const worn = obj(data.worn);
  const wieldOrWorn = Boolean(w || worn);
  const stack = data.stack === true || (!wieldOrWorn && data.piece !== true);
  return {
    name,
    type,
    shape,
    material,
    weight: data.weight === undefined ? null : Number(data.weight),
    maxDurability: stack || !wieldOrWorn ? null : Number(data.max_durability ?? material?.durability ?? NaN),
    defaultQuality: String(data.default_quality ?? 'common'),
    stack,
    value: Number(data.value ?? 0),
    goods: Array.isArray(data.goods) ? data.goods.map(String) : [],
    edible: typeof data.edible === 'boolean' ? data.edible : null,
    rotsTo: typeof data.rots_to === 'string' ? data.rots_to : null,
    carcassOf: typeof data.carcass_of === 'string' ? data.carcass_of : null,
    wield: w
      ? {
          weaponType: String(w.weapon_type),
          power: Number(w.power ?? 0),
          accuracy: Number(w.accuracy ?? 1),
          hands: Number(w.hands) === 2 ? 2 : 1,
          thrown: w.thrown === true,
          vsArmor: (obj(w.vs_armor) as Record<string, number>) ?? {},
          grantsMove: typeof w.grants_move === 'string' ? w.grants_move : null,
        }
      : null,
    worn: worn
      ? {
          slot: String(worn.slot),
          armor: worn.armor === true,
          punchPower: Number(worn.punch_power ?? 0),
          kickPower: Number(worn.kick_power ?? 0),
        }
      : null,
    effects,
  };
}

const armorShare = (cfg: BalanceConfig, item: ItemDef) =>
  item.worn?.armor ? (cfg.gear.bodyShares[item.worn.slot] ?? 0) : 0;

export function itemWeight(cfg: BalanceConfig, item: ItemDef): number {
  if (item.weight !== null) return item.weight;
  return (item.material?.setWeight ?? 0) * armorShare(cfg, item);
}

// Defense of one new armor piece. Wear scales it in battle.
export function armorDefense(cfg: BalanceConfig, item: ItemDef): number {
  return (item.material?.setDefense ?? 0) * armorShare(cfg, item);
}

// Which slot family the item fits: its worn slot, or a hand if it can only be wielded.
export function fitsSlot(item: ItemDef): string | null {
  if (item.worn) return item.worn.slot;
  return item.wield ? 'hand' : null;
}
