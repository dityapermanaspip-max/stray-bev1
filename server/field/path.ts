import { canStep, STEPS } from './climb.ts';
import { tileAt, type FieldGrid, type Point } from './types.ts';

// Shortest 4-neighbor path over steps the climbing rule allows. Returns the tiles to step onto (not the start),
// [] when already there, or null when the target is blocked, off the map, unreachable or too far.
export const findPath = (g: FieldGrid, from: Point, to: Point, maxSteps: number) => findPathToAny(g, from, [to], maxSteps);

// The same toward the nearest of several targets (the tiles beside a resource node); blocked targets are skipped.
export function findPathToAny(g: FieldGrid, from: Point, targets: Point[], maxSteps: number): Point[] | null {
  const key = (x: number, y: number) => y * g.width + x;
  const goals = new Set(targets.filter((t) => tileAt(g, t.x, t.y)?.walkable).map((t) => key(t.x, t.y)));
  if (goals.size === 0) return null;
  if (goals.has(key(from.x, from.y))) return [];
  const cameFrom = new Map<number, number>([[key(from.x, from.y), -1]]);
  let frontier = [key(from.x, from.y)];
  for (let depth = 0; frontier.length > 0 && depth < maxSteps; depth++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % g.width;
      const y = Math.floor(i / g.width);
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        const n = key(nx, ny);
        if (cameFrom.has(n) || !canStep(g, { x, y }, { x: nx, y: ny })) continue;
        cameFrom.set(n, i);
        if (goals.has(n)) return unwind(g, cameFrom, n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

function unwind(g: FieldGrid, cameFrom: Map<number, number>, end: number): Point[] {
  const path: Point[] = [];
  for (let i = end; cameFrom.get(i) !== -1; i = cameFrom.get(i)!) path.push({ x: i % g.width, y: Math.floor(i / g.width) });
  return path.reverse();
}
