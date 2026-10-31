import type { Progress } from '../../server/growth/level_up.ts';
import { parseItem, parseMaterial, type ItemCatalog } from '../../server/inventory/items.ts';
import type { CarcassData, LootData } from '../../server/inventory/loot.ts';
import { move } from './battle_data.ts';
import { catalog as gearCatalog } from './items.ts';

// Test copy of the chicken loot (db/seeds/03_items/02_loot) plus coins and a knife.
const iron = parseMaterial('iron', ['metal'], { durability: 120 });

export const catalog: ItemCatalog = new Map([
  ...gearCatalog,
  ...[
    parseItem('chicken_carcass', 'carcass', 'carcass', null, { weight: 3, value: 6, piece: true, carcass_of: 'chicken' }),
    parseItem('lizard_carcass', 'carcass', 'carcass', null, { weight: 6, value: 10, piece: true, carcass_of: 'lizard' }),
    parseItem('chicken_meat', 'food', 'meat', null, { weight: 0.5, value: 3, edible: true, rots_to: 'rotten_meat' }),
    parseItem('rotten_meat', 'food', 'meat', null, { weight: 0.8, value: 0, edible: false }),
    parseItem('tainted_meat', 'food', 'meat', null, { weight: 0.8, value: 0, edible: false }),
    parseItem('chicken_feather', 'part', 'feather', null, { weight: 0.05, value: 1 }),
    parseItem('chicken_beak', 'part', 'beak', null, { weight: 0.05, value: 0 }),
    parseItem('essence', 'essence', 'essence', null, { weight: 0.1, value: 8 }),
    parseItem('copper_coin', 'coin', 'coin', null, { weight: 0.01, value: 1 }),
    parseItem('silver_coin', 'coin', 'coin', null, { weight: 0.01, value: 100 }),
    parseItem('gold_coin', 'coin', 'coin', null, { weight: 0.01, value: 10000 }),
    parseItem('iron_knife', 'weapon', 'knife', iron, { weight: 0.5, wield: { weapon_type: 'knife', power: 4, hands: 1 } }),
  ].map((item) => [item.name, item] as const),
]);

export const loot: LootData = {
  bySpecies: new Map([
    ['chicken', {
      native: [
        { item: 'chicken_meat', permille: 900, min: 1, max: 2 },
        { item: 'chicken_feather', permille: 800, min: 2, max: 6 },
        { item: 'chicken_beak', permille: 500, min: 1, max: 1 },
      ],
      corrupted: [
        { item: 'tainted_meat', permille: 800, min: 1, max: 2 },
        { item: 'essence', permille: 700, min: 1, max: 1 },
      ],
    }],
  ]),
  essence: [
    { quality: 'crude', minTotal: 0, item: 'essence' },
    { quality: 'common', minTotal: 15, item: 'essence' },
    { quality: 'fine', minTotal: 30, item: 'essence' },
    { quality: 'masterwork', minTotal: 60, item: 'essence' },
  ],
};

export const HOUR = 3_600_000;
export const chicken = (over: Partial<CarcassData> = {}): CarcassData => ({
  species: 'chicken', corrupted: false, totalStats: 13, killedAt: 0, ...over,
});

export const butcheryMove = move({ name: 'butchery', category: 'life', effects: [], statExp: { dex: 3 } });
export const MOVES = new Map([['butchery', butcheryMove]]);

export function progress(butcheryLevel: number | null): Progress {
  const stat = { base: 5, exp: 0 };
  return {
    stats: { str: { ...stat }, dex: { ...stat }, int: { ...stat }, end: { ...stat }, luck: { ...stat }, charm: { ...stat } },
    moves: new Map(butcheryLevel === null ? [] : [['butchery', { level: butcheryLevel, exp: 0 }]]),
    recipes: new Set(),
  };
}
