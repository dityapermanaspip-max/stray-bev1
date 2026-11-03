// Typed view of the `biome_blend` key of balance_config (see seeds/39_blend/01_rank.sql). Public: the client needs the
// order to pick connector tiles (which biome is the lower-ranked one in a pair); it holds no numbers.
export type BlendConfig = { rank: string[] }; // biome names, gentlest first

export const blendConfig = (r: { rank: string[] }): BlendConfig => ({ rank: r.rank });

// Startup check: every biome has exactly one place in the order, and the order names no unknown biome.
export function findBlendProblems(cfg: BlendConfig, biomes: Set<string>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const b of cfg.rank) {
    if (!biomes.has(b)) problems.push(`biome_blend: unknown biome ${b}`);
    if (seen.has(b)) problems.push(`biome_blend: ${b} listed twice`);
    seen.add(b);
  }
  for (const b of biomes) if (!seen.has(b)) problems.push(`biome_blend: biome ${b} has no rank`);
  return problems;
}
