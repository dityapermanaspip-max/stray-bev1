import type { TickConfig } from '../config/balance.ts';

// Creature counts per species in one field, and the world tick rules on them (hidden, never sent).
// Natives grow and are capped at max; some turn corrupted; corrupted eat natives when the field is crowded.
// Natives at or below the safe floor are never converted or eaten. Integer counts only.

export type PopRow = { species: string; natives: number; corrupted: number; safe: number; max: number };

const total = (r: PopRow) => r.natives + r.corrupted;
const aboveFloor = (r: PopRow) => Math.max(0, r.natives - r.safe);

export function birth(cfg: TickConfig, r: PopRow): void {
  if (r.natives >= r.max) return;
  r.natives = Math.min(r.max, r.natives + Math.floor(r.natives * cfg.birth.rate));
}

export function conversion(cfg: TickConfig, r: PopRow): void {
  const turned = Math.min(Math.floor(r.natives * cfg.conversion.rate), aboveFloor(r));
  r.natives -= turned;
  r.corrupted += turned;
}

export function feeding(cfg: TickConfig, r: PopRow): void {
  if (total(r) <= cfg.feeding.threshold * r.max) return;
  r.natives -= Math.min(Math.floor(r.natives * cfg.feeding.rate), aboveFloor(r));
}

// How many times a rule with this interval fires between hour h-1 and hour h.
function fires(intervalHours: number, h: number): number {
  return Math.floor(h / intervalHours) - Math.floor((h - 1) / intervalHours);
}

// Runs the rules hour by hour for a field nobody touches. Returns a copy of the rows after each day.
export function simulate(cfg: TickConfig, timeScale: number, start: PopRow[], days: number): PopRow[][] {
  const rows = start.map((r) => ({ ...r }));
  const out: PopRow[][] = [];
  for (let h = 1; h <= days * 24; h++) {
    for (const r of rows) {
      for (let i = fires(cfg.birth.intervalHours * timeScale, h); i > 0; i--) birth(cfg, r);
      for (let i = fires(cfg.conversion.intervalHours * timeScale, h); i > 0; i--) conversion(cfg, r);
      for (let i = fires(cfg.feeding.intervalHours * timeScale, h); i > 0; i--) feeding(cfg, r);
    }
    if (h % 24 === 0) out.push(rows.map((r) => ({ ...r })));
  }
  return out;
}
