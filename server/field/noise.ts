import { createRng } from '../util/rng.ts';

// Seeded value noise in [0, 1): random values on a coarse lattice, smoothly interpolated.
// Neighboring tiles get similar values, so obstacles, hills and biome patches come in clumps.

export type Noise = (x: number, y: number) => number;

export function valueNoise(seed: number, cell: number, width: number, height: number): Noise {
  const size = Math.max(1, cell);
  const cols = Math.ceil(width / size) + 2;
  const rows = Math.ceil(height / size) + 2;
  const rng = createRng(seed);
  const lattice = Array.from({ length: cols * rows }, () => rng());
  const at = (i: number, j: number) => lattice[Math.min(rows - 1, j) * cols + Math.min(cols - 1, i)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / size;
    const gy = y / size;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const tx = smooth(gx - i);
    const ty = smooth(gy - j);
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

// Distinct seeds per layer, so the obstacle layer does not copy the hill layer.
export const layerSeed = (seed: number, layer: number) => (Math.imul(seed ^ 0x9e3779b9, layer * 2 + 1) ^ (layer * 0x85ebca6b)) >>> 0;
