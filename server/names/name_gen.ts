import type { Rng } from '../util/rng.ts';

// The name generator (pure). Every NPC has a first and a last name by race. A middle name goes only to notables and
// their descendants: it is drawn from the race's first names, and the heir keeps the notable's middle and last name.

export type Sex = 'male' | 'female';
export type NamePool = { male: string[]; female: string[]; last: string[] };
export type NamePools = Map<string, NamePool>; // by race_name
export type Family = { middle: string | null; last: string };

const choose = (rng: Rng, xs: string[]) => xs[Math.floor(rng() * xs.length)];

// A race with no pool of its own borrows another so no one is ever nameless; `fallback` is the first race with names.
const poolOf = (pools: NamePools, race: string): NamePool | null => pools.get(race) ?? pools.get('human') ?? [...pools.values()][0] ?? null;

export const rollSex = (rng: Rng): Sex => (rng() < 0.5 ? 'male' : 'female');

// A new family: a last name, and a middle name when the family is notable.
export function rollFamily(pools: NamePools, race: string, notable: boolean, rng: Rng): Family | null {
  const p = poolOf(pools, race);
  if (!p) return null;
  return { last: choose(rng, p.last), middle: notable ? choose(rng, [...p.male, ...p.female]) : null };
}

// A first name of the right sex, never the family's middle name.
export function rollGiven(pools: NamePools, race: string, sex: Sex, rng: Rng, avoid: string | null = null): string | null {
  const p = poolOf(pools, race);
  if (!p) return null;
  const xs = (sex === 'male' ? p.male : p.female).filter((n) => n !== avoid);
  return choose(rng, xs.length > 0 ? xs : p.male);
}

export const fullName = (given: string, f: Family) => [given, f.middle, f.last].filter(Boolean).join(' ');

// A whole name. Pass `family` for a descendant (or anyone of a known house); otherwise a new family is rolled.
export function rollName(pools: NamePools, race: string, sex: Sex, notable: boolean, rng: Rng, family: Family | null = null): string | null {
  const f = family ?? rollFamily(pools, race, notable, rng);
  const given = rollGiven(pools, race, sex, rng, f?.middle ?? null);
  return f && given ? fullName(given, f) : null;
}

// The family inside a name made by rollName: "First Last" or "First Middle Last".
export function familyOf(name: string): Family | null {
  const parts = name.split(' ');
  if (parts.length === 2) return { middle: null, last: parts[1] };
  if (parts.length === 3) return { middle: parts[1], last: parts[2] };
  return null;
}
