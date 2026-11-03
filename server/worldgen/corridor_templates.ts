import type { FieldTemplate } from '../field/types.ts';

// Which template a corridor gets: a border in hex direction 0 runs along x, directions 1 and 2 along y (the three
// directions planWorld makes borders in); the corridor's own seed picks among the shapes of that travel. Pure.
export function corridorTemplate(templates: Iterable<FieldTemplate>, dir: number, seed: number, fallback: string): string {
  const travel = dir === 0 ? 'x' : 'y';
  const fits = [...templates].filter((t) => t.kind === 'corridor' && t.travel === travel).map((t) => t.name).sort();
  return fits.length === 0 ? fallback : fits[seed % fits.length];
}

// Startup check: both travels have a shape, so no border falls back to the old one.
export function findCorridorProblems(templates: FieldTemplate[]): string[] {
  return (['x', 'y'] as const).filter((tr) => !templates.some((t) => t.kind === 'corridor' && t.travel === tr)).map((tr) => `no corridor template with travel ${tr}`);
}
