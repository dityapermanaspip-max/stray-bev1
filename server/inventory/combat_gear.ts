import { emptyGear } from '../battle/factory.ts';
import type { CombatGear, CombatWeapon, EffectDef, GearTrigger, MoveDef } from '../battle/types.ts';
import type { BalanceConfig } from '../config/balance.ts';
import type { Derived } from '../stats/derived.ts';
import { goodChance, rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import { removeStack, stackedValue, stackKey, wearFactor, type Inventory } from './bag.ts';
import { armorDefense, type ItemCatalog, type ItemDef } from './items.ts';

// Turns what an entity has equipped into the gear the battle reads, and writes the fight back afterwards.
// The weapon is the main hand, else the off hand. Armor and accessories are every other slot.

const HANDS = ['main_hand', 'off_hand'];

// A hidden move that carries an item effect through the normal handlers. Never shown, never pays exp.
function itemMove(item: string, effect: EffectDef): MoveDef {
  const damageType = typeof effect.params.damage_type === 'string' ? effect.params.damage_type : null;
  return {
    name: `item:${item}`, category: 'item', damageType, damageKind: damageType ? 'physical' : null, element: null,
    resource: null, cost: 0, target: 'one_enemy', rowRule: 'any', windup: 0, recovery: 0, cooldown: null,
    channel: false, expScaling: 0, overrides: { damage: 0, recovery: 0, cost: 0 }, growthTag: 'item',
    tags: [], effects: [effect], requires: [], statExp: {}, gives: [], brokenBy: [],
  };
}

const qualityMult = (cfg: BalanceConfig, quality: string) => cfg.qualityMult.get(quality) ?? 1;

export function buildCombatGear(cfg: BalanceConfig, catalog: ItemCatalog, inv: Inventory): CombatGear {
  const gear = emptyGear();
  const worn: { def: ItemDef; wear: number }[] = [];

  for (const slot of HANDS) {
    if (gear.weapon) break;
    const piece = inv.pieces.find((p) => p.slot === slot);
    const stack = [...inv.stacks.values()].find((s) => s.slot === slot);
    const def = catalog.get(piece?.item ?? stack?.item ?? '');
    if (!def?.wield) continue;
    const wear = piece ? wearFactor(cfg, piece.durability, def.maxDurability ?? 0) : 1;
    const weapon: CombatWeapon = {
      power: def.wield.power * qualityMult(cfg, piece?.quality ?? def.defaultQuality) * wear,
      accuracy: def.wield.accuracy,
      vsArmor: def.wield.vsArmor,
      pieceId: piece?.id ?? null,
      thrownItem: stack && def.wield.thrown ? stackKey(stack.item, stack.quality) : null,
      thrownLeft: stack?.qty ?? 0,
    };
    gear.weapon = weapon;
    gear.weaponType = def.wield.weaponType;
    worn.push({ def, wear });
  }

  for (const p of inv.pieces) {
    if (!p.slot || HANDS.includes(p.slot)) continue;
    const def = catalog.get(p.item)!;
    const wear = wearFactor(cfg, p.durability, def.maxDurability ?? 0);
    worn.push({ def, wear });
    if (!def.worn) continue;
    gear.punchPower += def.worn.punchPower * wear;
    gear.kickPower += def.worn.kickPower * wear;
    if (!def.worn.armor || wear === 0) continue;
    const share = cfg.gear.bodyShares[def.worn.slot] ?? 0;
    gear.defense += armorDefense(cfg, def) * wear;
    gear.armorPieces.push({ id: p.id, share });
    for (const tag of def.material?.tags ?? []) gear.coverage[tag] = (gear.coverage[tag] ?? 0) + share;
  }

  // Worn stat effects stack with falloff per stat; triggered effects run as hidden item moves.
  const adds = new Map<keyof Derived, number[]>();
  for (const { def, wear } of worn) {
    if (wear === 0) continue;
    for (const { trigger, effect } of def.effects) {
      if (trigger === 'worn' && effect.handler === 'buff') {
        const stat = effect.params.stat as keyof Derived;
        adds.set(stat, [...(adds.get(stat) ?? []), Number(effect.params.add ?? 0) * wear]);
      } else if (trigger === 'on_hit' || trigger === 'on_struck' || trigger === 'on_dodge') {
        gear.triggers.push({ trigger, effect, move: itemMove(def.name, effect) } satisfies GearTrigger);
      }
    }
  }
  for (const [stat, values] of adds) gear.statAdd[stat] = stackedValue(cfg, values);
  return gear;
}

export type GearOutcome = { broken: string[]; thrownBack: number };

// After the fight: pieces lose their wear, spent throws are gone unless recovered after a win.
// The thrower's luck adds to each recovery roll.
export function applyBattleWear(cfg: BalanceConfig, inv: Inventory, gear: CombatGear, won: boolean, luck: number, rng: Rng): GearOutcome {
  const broken: string[] = [];
  for (const [id, lost] of gear.wear) {
    const piece = inv.pieces.find((p) => p.id === id);
    if (!piece || piece.durability <= 0) continue;
    piece.durability = Math.max(0, piece.durability - lost);
    if (piece.durability === 0) broken.push(piece.item);
  }
  let thrownBack = 0;
  const item = gear.weapon?.thrownItem;
  if (item && gear.thrownSpent > 0) {
    const recovery = goodChance(cfg.luck, cfg.gear.ammoRecoveryPermille, luck);
    if (won) for (let i = 0; i < gear.thrownSpent; i++) if (rollPermille(rng, recovery)) thrownBack++;
    const lost = gear.thrownSpent - thrownBack;
    const held = inv.stacks.get(item)?.qty ?? 0;
    if (lost > 0 && held > 0) removeStack(inv, item, Math.min(lost, held));
  }
  return { broken, thrownBack };
}
