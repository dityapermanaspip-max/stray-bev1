import type { Rng } from '../util/rng.ts';
import { notablesFor, poolSize, type RecruitConfig, type RecruitTemplate } from './recruit_rules.ts';

// What a town still needs to have a full roster (hidden). Pure: the repo writes it.
//   Notables by town size (village elder and chief guard always). Every door keeper and notable offers one heir or
//   pupil of each lineage template that names it and fits the town's race (the shop: its heir, and the butcher's son
//   or daughter). The pool fills up to its share of the people living there: each place is of the town's race, or
//   (visitor_share) of another race, then a template that race can be, by weight x the culture's pool weight.
//   A recruit leaves the town, so a refill later reads the population as it is then.

export type TownForRoster = {
  ref: string; ring: number; population: number; services: string[];
  race: string; // the folk of its culture
  visitors: string[]; // other races that may pass through
  visitorShare: number;
  poolWeights: Record<string, number>; // template -> weight multiplier (missing = 1, 0 = never here)
};
export type RosterNow = { pool: number; offering: Set<string> }; // pool size now; `parent|template` already offered
export type RosterPlan = {
  notables: string[]; // every notable role the town has (made if missing)
  lineage: { parent: string; template: RecruitTemplate; race: string }[];
  pool: { template: RecruitTemplate; race: string }[];
};

export const fitsRace = (t: RecruitTemplate, race: string) => t.races.length === 0 || t.races.includes(race);

function byWeight(rng: Rng, options: readonly { t: RecruitTemplate; w: number }[]): RecruitTemplate | null {
  const total = options.reduce((n, o) => n + o.w, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  return (options.find((o) => (roll -= o.w) < 0) ?? options[options.length - 1]).t;
}

export function planRoster(
  rc: RecruitConfig, rings: number, town: TownForRoster, templates: readonly RecruitTemplate[], now: RosterNow, rng: Rng,
): RosterPlan {
  const notables = notablesFor(rc, town.population);
  const lineage: RosterPlan['lineage'] = [];
  for (const parent of [...town.services, ...notables]) {
    for (const template of templates) {
      if (template.source === 'lineage' && template.parents.includes(parent) && fitsRace(template, town.race)
        && !now.offering.has(`${parent}|${template.name}`)) {
        lineage.push({ parent, template, race: town.race });
      }
    }
  }
  const optionsFor = (race: string, home: boolean) => templates
    .filter((t) => t.source === 'pool' && t.weight > 0 && fitsRace(t, race))
    .map((t) => ({ t, w: t.weight * (home ? (town.poolWeights[t.name] ?? 1) : 1) }));
  const pool: RosterPlan['pool'] = [];
  for (let i = now.pool; i < poolSize(rc, town.ring, rings, town.population); i++) {
    const visitor = town.visitors.length > 0 && rng() < town.visitorShare;
    const race = visitor ? town.visitors[Math.floor(rng() * town.visitors.length)] : town.race;
    const t = byWeight(rng, optionsFor(race, !visitor));
    if (t) pool.push({ template: t, race });
  }
  return { notables, lineage, pool };
}
