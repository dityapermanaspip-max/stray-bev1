import type { BalanceConfig } from '../config/balance.ts';
import { hasTraitFlag, rollEntityTraits, traitElements, type Trait, type TraitOption } from '../growth/traits.ts';
import type { UnlockRule } from '../growth/unlocks.ts';
import { STATS, type CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { rollMoves } from '../world/creature_roll.ts';
import type { RecruitConfig, RecruitTemplate } from './recruit_rules.ts';

// Rolls one recruit from its template (hidden, server only). Same rules as a creature, except:
//   Stats: the template's plus the race's stat_mods (never below 1), whatever the ring. The roll writes move levels directly and pays no stat exp
//   (stat exp only ever comes from the move level-up function, after the recruit is met).
//   Budget: the ring's creature move budget +- budget_spread. Life skills roll apart, from the template's ranges.
//   Traits: the quota roll; a trait flag can add pool moves and gear (dual_wield: dual knife moves, a second knife).
//   Forced elements (apprentice healer: holy) ride on an element trait: one is added if none was rolled.

export type RaceMods = { name: string; statMods: Partial<CoreStats> };

// A template flag: a trait flag (dual_wield), 'element' (any element affinity), or either with '!' for "has not".
export function flagOn(traits: readonly Trait[], flag: string): boolean {
  const not = flag.startsWith('!');
  const name = not ? flag.slice(1) : flag;
  const has = name === 'element' ? traitElements(traits).length > 0 : hasTraitFlag(traits, name);
  return not ? !has : has;
}

export type RolledRecruit = {
  race: string;
  stats: CoreStats;
  traits: Trait[];
  moves: { name: string; level: number; equipped: boolean }[]; // battle moves, best first
  life: { name: string; level: number }[];
  gear: { item: string; slot: string }[];
  totalLevels: number; // battle move levels: what the recruit threshold and a mercenary's wage read
};

export function rollRecruit(
  cfg: BalanceConfig, rc: RecruitConfig, t: RecruitTemplate, ring: number, rng: Rng,
  unlocks: readonly UnlockRule[], traitOptions: readonly TraitOption[], race: RaceMods = { name: 'human', statMods: {} },
): RolledRecruit {
  const between = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const traits = forceElements(rollEntityTraits(rng, cfg.traits, traitOptions), t.elements, traitOptions);
  const flags = Object.keys(t.flagMoves).filter((f) => flagOn(traits, f));
  const pool = [...t.moves, ...flags.flatMap((f) => t.flagMoves[f])];
  const all = new Set([...t.open, ...pool]);
  const r = Math.max(1, Math.min(cfg.rings.count, Math.round(ring)));
  const budget = Math.max(1, cfg.creatureGen.moveBudget.get(r)! + between(-rc.budgetSpread, rc.budgetSpread));
  const moves = rollMoves(cfg, { pool, open: t.open, rules: unlocks.filter((u) => all.has(u.move)), budget, die: cfg.creatureGen.die.get(r)!, rng });
  const life = Object.entries(t.life).map(([name, [lo, hi]]) => ({ name, level: between(lo, hi) })).filter((l) => l.level > 0);
  const gear = [...t.gear, ...Object.entries(t.flagGear).filter(([f]) => flagOn(traits, f)).flatMap(([, g]) => g)];
  const stats = Object.fromEntries(STATS.map((s) => [s, Math.max(1, t.stats[s] + (race.statMods[s] ?? 0))])) as CoreStats;
  return { race: race.name, stats, traits, moves, life, gear, totalLevels: moves.reduce((n, m) => n + m.level, 0) };
}

// Makes sure the forced elements are among the rolled ones: put them into a rolled element trait, or add the
// element trait that holds exactly that many (free: a template's calling, not the quota).
function forceElements(traits: Trait[], forced: readonly string[], options: readonly TraitOption[]): Trait[] {
  if (forced.length === 0) return traits;
  const rolled = traits.find((t) => Array.isArray(t.params.elements));
  if (rolled) {
    const els = [...(rolled.params.elements as string[])];
    for (const f of forced) {
      if (els.includes(f)) continue;
      const free = els.findIndex((e) => !forced.includes(e));
      if (free >= 0) els[free] = f;
    }
    rolled.params = { ...rolled.params, elements: els };
    return traits;
  }
  const fit = options.find((o) => o.modifiers.group === 'element' && Number(o.modifiers.elements) === forced.length);
  if (!fit) return traits;
  return [...traits, { name: fit.name, modifiers: fit.modifiers, params: { elements: [...forced] } }];
}
