import type { GameWorld } from '../game/world.ts';
import type { WorldLinks } from '../field/links.ts';
import type { Rng } from '../util/rng.ts';
import type { Foe } from '../world/encounter.ts';
import { enterBoss, ensureBoss, feedBoss, refundKeys } from './boss_repo.ts';

// The way into the boss hex (the centre, ring 0). Players hear only that every key type is needed to open it.
// Stepping in with a full set spends it and starts the boss fight at once; without one the way stays sealed.

export const isBossHex = (links: WorldLinks, ref: string) => {
  const h = links.hexes.get(ref);
  return !!h && h.q === 0 && h.r === 0;
};

export async function openBossGate(world: GameWorld, entityId: string, rng: Rng): Promise<{ foes: Foe[] } | { line: string }> {
  const { cfg } = world.data;
  const bossId = await ensureBoss(world.pool, cfg, world.roundId, rng);
  await feedBoss(world.pool, cfg, world.data.moves, world.roundId, rng); // vices born since the last attempt
  const entry = await enterBoss(world.pool, cfg, world.roundId, entityId);
  if (entry.sealed) return { line: 'boss.sealed' };
  return { foes: [{ species: 'boss', corrupted: true, boss: { id: bossId, weaken: entry.weaken, keys: entry.keys } }] };
}

// The chamber door as the field room uses it: opens the gate and starts the fight with `start`; keys spent for a
// fight that could not open come back. Answers a line key to say when the player stays outside, else null.
export async function passBossGate(world: GameWorld, entityId: string, rng: Rng, start: (foes: Foe[]) => Promise<boolean>): Promise<string | null> {
  try {
    const gate = await openBossGate(world, entityId, rng);
    if ('line' in gate) return gate.line;
    if (!(await start(gate.foes))) await refundKeys(world.pool, gate.foes[0].boss!.keys);
    return null;
  } catch (err) {
    console.error(`boss gate failed: ${(err as Error).message}`);
    return 'field.no_way';
  }
}
