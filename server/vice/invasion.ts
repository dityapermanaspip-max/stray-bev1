import type { Rng } from '../util/rng.ts';
import type { PopRow } from '../world/population.ts';
import { hexDistance } from '../world/world_hour.ts';

// Invasions (hidden, docs/WORLD.md). A hex led by a vice whose creatures reach threshold x max pop sends `share` of
// its corrupted, led by the vice, to the nearest vice-free wild hex (random among ties; never a town or the boss
// hex). The invaders join that hex's corrupted counts and the vice settles there. A new vice of a random type is born
// in the hex they left. With no free hex the vice waits and nothing is born. Pure: the repo writes the result.

export type InvasionConfig = { intervalHours: number; threshold: number; share: number };
export type InvasionHex = { id: string; q: number; r: number; ring: number; town: boolean };
export type Invasion = { viceId: string; from: string; to: string; invaders: Map<string, number> }; // species -> count

const totals = (rows: PopRow[]) => rows.reduce((t, r) => ({ all: t.all + r.natives + r.corrupted, max: t.max + r.max }), { all: 0, max: 0 });

export function overflowing(cfg: InvasionConfig, rows: PopRow[]): boolean {
  const t = totals(rows);
  return t.max > 0 && t.all >= cfg.threshold * t.max;
}

// Plans this hour's invasions and applies them to the counts in place (new rows for species the target lacks).
// `vices`: hex id -> vice id, updated in place (the vice moves; the source is marked taken for the new-born vice).
export function planInvasions(
  cfg: InvasionConfig, hexes: InvasionHex[], pop: Map<string, PopRow[]>, vices: Map<string, string>, rng: Rng,
): Invasion[] {
  const out: Invasion[] = [];
  const byId = new Map(hexes.map((h) => [h.id, h]));
  const leaders = [...vices].filter(([hex]) => byId.has(hex)).sort((a, b) => (a[0] < b[0] ? -1 : 1)); // fixed order
  for (const [from, viceId] of leaders) {
    const rows = pop.get(from) ?? [];
    if (!overflowing(cfg, rows)) continue;
    const src = byId.get(from)!;
    const free = hexes.filter((h) => !h.town && h.ring >= 1 && !vices.has(h.id));
    if (free.length === 0) continue; // it waits
    const near = Math.min(...free.map((h) => hexDistance(src, h)));
    const ties = free.filter((h) => hexDistance(src, h) === near);
    const to = ties[Math.floor(rng() * ties.length)];
    const invaders = new Map<string, number>();
    const target = pop.get(to.id) ?? [];
    for (const r of rows) {
      const n = Math.floor(r.corrupted * cfg.share);
      if (n <= 0) continue;
      r.corrupted -= n;
      invaders.set(r.species, n);
      const there = target.find((t) => t.species === r.species);
      if (there) there.corrupted += n;
      else target.push({ species: r.species, natives: 0, corrupted: n, safe: 0, max: 0 });
    }
    pop.set(to.id, target);
    vices.delete(from);
    vices.set(to.id, viceId);
    vices.set(from, ''); // taken by the vice born here (the repo makes it)
    out.push({ viceId, from, to: to.id, invaders });
  }
  return out;
}
