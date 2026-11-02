import type { Progress } from './level_up.ts';

// The one generic unlock checker. Rules come from moves.move_unlocks and stay server-side.
// Same option group = every condition must pass. Different groups = any one group is enough.

export type UnlockRule = {
  move: string;
  group: string;
  kind: string; // mastery, trainer, scroll, combo
  params: Record<string, unknown>;
};

// Things outside the entity's own knowledge, e.g. the trainer standing in front of it.
export type UnlockContext = { trainerTags: ReadonlySet<string> };

export type Learned = { move: string; kind: string };
type Known = Pick<Progress, 'moves' | 'recipes'>; // all the checker reads

// Kinds this checker understands. Each needs an epiphany_<kind> line pool.
export const UNLOCK_KINDS = ['mastery', 'trainer', 'scroll', 'combo'];
export const EPIPHANY_PREFIX = 'epiphany_';

const NO_CONTEXT: UnlockContext = { trainerTags: new Set() };

function conditionMet(rule: UnlockRule, progress: Known, ctx: UnlockContext): boolean {
  const p = rule.params;
  switch (rule.kind) {
    case 'mastery':
    case 'combo':
      return (progress.moves.get(String(p.move))?.level ?? 0) >= Number(p.level);
    case 'trainer':
      return ctx.trainerTags.has(String(p.trainer_tag));
    case 'scroll':
      return progress.recipes.has(rule.move);
    default:
      return false; // unknown kinds never unlock
  }
}

// Moves whose rules now pass and that the entity does not know yet.
export function findUnlocks(rules: UnlockRule[], progress: Known, ctx: UnlockContext = NO_CONTEXT): Learned[] {
  const groups = new Map<string, UnlockRule[]>();
  for (const rule of rules) {
    if (progress.moves.has(rule.move)) continue;
    const key = `${rule.move}\u0000${rule.group}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  const learned = new Map<string, Learned>();
  for (const group of groups.values()) {
    const move = group[0].move;
    if (learned.has(move) || !group.every((r) => conditionMet(r, progress, ctx))) continue;
    learned.set(move, { move, kind: group[0].kind });
  }
  return [...learned.values()];
}

// Registers every passing move at level 1. Learned moves stay unequipped.
export function learnUnlocks(rules: UnlockRule[], progress: Progress, ctx: UnlockContext = NO_CONTEXT): Learned[] {
  const all: Learned[] = [];
  for (let found = findUnlocks(rules, progress, ctx); found.length > 0; found = findUnlocks(rules, progress, ctx)) {
    for (const l of found) progress.moves.set(l.move, { level: 1, exp: 0 });
    all.push(...found);
  }
  return all;
}
