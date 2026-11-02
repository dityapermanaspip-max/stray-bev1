import type { BattleEntity } from '../battle/types.ts';
import type { Derived } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';

// Traits: what an entity was born with. Modifiers are hidden and never leave the server.
// Code reads modifier keys (dual_wield, resist, stat_add, elements, ...), never a trait's name.
// params hold what was rolled for this one entity (its elements, its resisted element).

export type Trait = { name: string; modifiers: Record<string, unknown>; params: Record<string, unknown> };
export type TraitOption = { name: string; cost: number; weight: number; modifiers: Record<string, unknown> };
export type TraitRules = {
  quota: { min: number; max: number }; // flat roll
  window: { minShare: number; maxShare: number }; // a pick costs this share of the quota still left
  elements: string[]; // basic elements an element trait can roll
};

export const hasTraitFlag = (traits: readonly Trait[], flag: string) => traits.some((t) => t.modifiers[flag] === true);

export const rollQuota = (rng: Rng, r: TraitRules) => r.quota.min + Math.floor(rng() * (r.quota.max - r.quota.min + 1));

// Keep picking by weight among traits costing minShare..maxShare of the quota left, until none is in the window.
// Each trait at most once; one trait per modifiers.group (e.g. a single element trait). Rarity is weight only.
export function rollTraits(rng: Rng, quota: number, options: readonly TraitOption[], window: TraitRules['window']): TraitOption[] {
  const picked: TraitOption[] = [];
  let left = quota;
  for (;;) {
    const groups = new Set(picked.map((p) => p.modifiers.group).filter(Boolean));
    const fits = options.filter((o) => o.weight > 0 && !picked.includes(o) && !groups.has(o.modifiers.group)
      && o.cost >= window.minShare * left && o.cost <= window.maxShare * left);
    const total = fits.reduce((n, o) => n + o.weight, 0);
    if (total <= 0) return picked;
    let roll = rng() * total;
    const pick = fits.find((o) => (roll -= o.weight) < 0) ?? fits[fits.length - 1];
    picked.push(pick);
    left -= pick.cost;
  }
}

// n different elements, in random order.
function pickElements(rng: Rng, elements: readonly string[], n: number): string[] {
  const pool = [...elements];
  const out: string[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

// What a picked trait rolls for its owner: element traits their elements, a random ward its element.
export function rollTraitParams(rng: Rng, opt: TraitOption, elements: readonly string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const n = Number(opt.modifiers.elements ?? 0);
  if (n > 0) params.elements = pickElements(rng, elements, n);
  if (opt.modifiers.resist_random_element !== undefined) params.element = pickElements(rng, elements, 1)[0];
  return params;
}

// The full roll: quota, picks, then each pick's own rolls.
export function rollEntityTraits(rng: Rng, rules: TraitRules, options: readonly TraitOption[]): Trait[] {
  return rollTraits(rng, rollQuota(rng, rules), options, rules.window)
    .map((o) => ({ name: o.name, modifiers: o.modifiers, params: rollTraitParams(rng, o, rules.elements) }));
}

// Resistance multipliers (`kind:id` -> mult) from traits: fixed ones (modifiers.resist) and a rolled element ward.
export function traitResist(traits: readonly Trait[]): Map<string, number> {
  const out = new Map<string, number>();
  const mul = (key: string, mult: number) => out.set(key, (out.get(key) ?? 1) * mult);
  for (const t of traits) {
    for (const [key, mult] of Object.entries((t.modifiers.resist as Record<string, number>) ?? {})) mul(key, Number(mult));
    if (typeof t.params.element === 'string' && t.modifiers.resist_random_element !== undefined) {
      mul(`element:${t.params.element}`, Number(t.modifiers.resist_random_element));
    }
  }
  return out;
}

// Flat derived-stat additions (modifiers.stat_add), summed.
export function traitStatAdd(traits: readonly Trait[]): Partial<Record<keyof Derived, number>> {
  const out: Partial<Record<keyof Derived, number>> = {};
  for (const t of traits) {
    for (const [stat, add] of Object.entries((t.modifiers.stat_add as Record<string, number>) ?? {})) {
      const k = stat as keyof Derived;
      out[k] = (out[k] ?? 0) + Number(add);
    }
  }
  return out;
}

// Puts an entity's traits into its battle shape: resistances and stat additions (beside gear's).
export function applyTraits(e: BattleEntity, traits: readonly Trait[]): void {
  for (const [key, mult] of traitResist(traits)) e.resist.set(key, (e.resist.get(key) ?? 1) * mult);
  for (const [stat, add] of Object.entries(traitStatAdd(traits))) {
    const k = stat as keyof Derived;
    e.gear.statAdd[k] = (e.gear.statAdd[k] ?? 0) + add;
  }
}

// Elements an entity's traits gave it affinity with (saved to entity_affinity; element_slots = how many).
export const traitElements = (traits: readonly Trait[]): string[] =>
  traits.flatMap((t) => (Array.isArray(t.params.elements) ? t.params.elements.map(String) : []));

export const TRAIT_NAME_PREFIX = 'trait_name_';
export const TRAIT_FLAVOR_PREFIX = 'trait_flavor_';
const RESIST_KINDS = ['damage_type', 'element', 'status'];
// Derived stats the battle reads with gear and trait additions (core.stat).
const STAT_ADD_KEYS: readonly (keyof Derived)[] = ['speed', 'accuracy', 'critChance', 'dodgeChance'];

// Startup check: names and flavor lines, known stat and resist keys, element counts the element list can fill.
export function findTraitProblems(options: readonly TraitOption[], lineKeys: ReadonlySet<string>, elements: unknown): string[] {
  const problems: string[] = [];
  const els = Array.isArray(elements) ? elements : [];
  if (els.length === 0) problems.push('balance_config elements is missing or empty');
  for (const o of options) {
    for (const prefix of [TRAIT_NAME_PREFIX, TRAIT_FLAVOR_PREFIX]) {
      if (!lineKeys.has(prefix + o.name)) problems.push(`trait ${o.name}: no ${prefix} line`);
    }
    for (const k of Object.keys((o.modifiers.stat_add as object) ?? {})) {
      if (!STAT_ADD_KEYS.includes(k as keyof Derived)) problems.push(`trait ${o.name}: unknown stat_add ${k}`);
    }
    for (const k of Object.keys((o.modifiers.resist as object) ?? {})) {
      if (!RESIST_KINDS.includes(k.split(':')[0])) problems.push(`trait ${o.name}: bad resist key ${k}`);
    }
    if (Number(o.modifiers.elements ?? 0) > els.length) problems.push(`trait ${o.name}: more elements than the element list`);
  }
  return problems;
}
