import { FAVOR_NAME_PREFIX } from '../db/startup_check.ts';
import type { SwapPlace } from '../loadout/loadout.ts';
import { unlocked } from '../recruit/companion_rules.ts';
import { bearingOf, companionsOf } from '../recruit/companions.ts';
import type { Rng } from '../util/rng.ts';
import type { PartyView } from '../../shared/town.ts';
import type { StatusPanel } from '../../shared/town.ts';
import { statusPanel } from './status_service.ts';
import type { GameWorld } from './world.ts';

// The party tab: who is with the player and how close they are (the favor tier's word). A companion's own status window
// (read only) opens once the bond reaches config standing.ladder.unlocks.status.

type Ctx = { world: GameWorld; rng: Rng };

export async function partyView(c: Ctx, playerId: string): Promise<PartyView> {
  const { cfg, lines } = c.world.data;
  const ids = await companionsOf(c.world, playerId);
  const names = await c.world.pool.query<{ id: string; name: string }>('SELECT id::text AS id, name FROM entity.entities WHERE id = ANY($1::uuid[])', [ids]);
  const members = await Promise.all(ids.map(async (id) => {
    const b = await bearingOf(c.world, c.rng, playerId, id);
    return {
      id, name: names.rows.find((n) => n.id === id)?.name ?? '', bond: b ? lines.pick(c.rng, FAVOR_NAME_PREFIX + b.tier, 0, 'self')?.text ?? null : null,
      open: !!b && unlocked(cfg.standing.ladder, 'status', b.tier),
    };
  }));
  return { members };
}

// Null when they are not with the player or the bond is too thin.
export async function companionPanel(c: Ctx, playerId: string, id: string, place: SwapPlace): Promise<StatusPanel | null> {
  const member = (await partyView(c, playerId)).members.find((m) => m.id === id);
  return member?.open ? statusPanel(c, id, place, null, false) : null;
}
