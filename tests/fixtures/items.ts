import { parseItem, parseMaterial, type ItemCatalog } from '../../server/inventory/items.ts';

// Test copy of a few seeded materials and items (db/seeds/03_items/01_items).
const leather = parseMaterial('leather', ['leather'], { set_defense: 3, set_weight: 8, durability: 60 });
const iron = parseMaterial('iron', ['metal'], { set_defense: 7, set_weight: 30, durability: 120 });
const stone = parseMaterial('stone', ['stone'], {});
const copper = parseMaterial('copper', ['metal'], { durability: 100 });

const SLOTS = ['head', 'body', 'hands', 'pants', 'feet'];

export const catalog: ItemCatalog = new Map([
  ...SLOTS.map((slot) => parseItem(`leather_${slot}`, 'armor', slot, leather, { worn: { slot, armor: true } })),
  ...SLOTS.map((slot) => parseItem(`iron_${slot}`, 'armor', slot, iron, { worn: { slot, armor: true } })),
  parseItem('iron_sword', 'weapon', 'sword', iron, {
    weight: 3, wield: { weapon_type: 'sword', power: 7, hands: 1, grants_move: 'sword_slash' },
  }),
  parseItem('iron_hammer', 'weapon', 'hammer', iron, {
    weight: 6, wield: { weapon_type: 'hammer', power: 9, hands: 2, vs_armor: { metal: 0.1 }, grants_move: 'hammer_smash' },
  }),
  parseItem('river_stone', 'material', 'stone', stone, {
    weight: 0.5, stack: true, default_quality: 'improvised',
    wield: { weapon_type: 'thrown', power: 3, hands: 1, thrown: true, grants_move: 'basic_throw' },
  }),
  parseItem('copper_ring', 'accessory', 'ring', copper, { weight: 0.05, worn: { slot: 'ring' } }),
  parseItem('blanket', 'material', 'blanket', null, { weight: 1.5 }),
].map((item) => [item.name, item]));
