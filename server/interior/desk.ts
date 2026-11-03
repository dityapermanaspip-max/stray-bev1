import type { ExitTarget } from '../field/links.ts';
import type { FieldGrid, ResourceNode } from '../field/types.ts';
import { guards } from '../gather/gather.ts';
import type { GameWorld } from '../game/world.ts';
import { badChance, rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import type { Foe } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import type { FieldView } from '../../shared/field.ts';
import type { TalkRequest } from '../../shared/talk.ts';
import { interiorRef, parseInterior, type InteriorRef } from './interior_ref.ts';
import { placeNpcs, withNpcs, type Placed } from './npc_place.ts';
import { talkAct, talkView, type TalkOut } from './talk.ts';
import type { TalkView } from '../../shared/talk.ts';

// What a field room knows about rooms inside fields: who stands in it (if it is one), where a town door or a wild
// node leads, how talking goes, and whether resting in the wild brings creatures.

export class RoomDesk {
  readonly room: InteriorRef | null;
  private npcs: Placed[] = [];

  private world: GameWorld;
  private ref: string;

  constructor(world: GameWorld, ref: string) {
    [this.world, this.ref] = [world, ref];
    this.room = parseInterior(ref);
  }

  // The room's grid with its people (the cached base grid stays empty), and the view to draw. Other fields: unchanged.
  async refresh(rng: Rng, base: FieldGrid, view: FieldView): Promise<{ grid: FieldGrid; view: FieldView }> {
    const layout = this.room && this.world.data.cfg.interior.rooms[this.room.kind];
    if (!this.room || !layout) return { grid: base, view };
    this.npcs = await placeNpcs(this.world, rng, this.room, layout);
    const grid = withNpcs(base, this.npcs);
    const tiles = view.tiles.map((t, i) => ({ ...t, w: grid.tiles[i].walkable }));
    return { grid, view: { ...view, tiles, npcs: this.npcs.map((n) => ({ id: n.id, x: n.x, y: n.y, name: n.name, role: n.role, sex: n.sex, look: n.look })) } };
  }

  // The town door's room (shop, inn, trainer), or null when that service has none (it opens its panel).
  doorTarget(service: string): ExitTarget | null {
    return this.world.data.cfg.interior.rooms[service] ? { ref: interiorRef(this.ref, service), exit: 'door' } : null;
  }

  // A camp or cave node leads into its room.
  nodeTarget(node: ResourceNode): ExitTarget | null {
    return this.world.data.cfg.interior.wild[node.kind] ? { ref: interiorRef(this.ref, node.kind, node.id), exit: 'door' } : null;
  }

  isNpc = (node: ResourceNode) => node.kind === 'npc';

  private ctx(rng: Rng, playerId: string) {
    return { world: this.world, rng, playerId, townRef: this.room?.parent ?? this.ref };
  }

  open(rng: Rng, playerId: string, id: number): Promise<TalkView> | null {
    const npc = this.npcs.find((n) => n.id === id);
    return npc ? talkView(this.ctx(rng, playerId), npc, null) : null;
  }

  act(rng: Rng, playerId: string, id: number | null, req: TalkRequest): Promise<TalkOut> | null {
    const npc = this.npcs.find((n) => n.id === id);
    return npc ? talkAct(this.ctx(rng, playerId), npc, req) : null;
  }

  // After a rest at a camp or cave: creatures may come (the field's own creatures, as at a dark node).
  ambush(service: string, rows: PopRow[], luck: number, rng: Rng, groupCap: number): Foe[] | null {
    const { cfg } = this.world.data;
    const wild = cfg.interior.wild[service];
    if (!wild || !rollPermille(rng, badChance(cfg.luck, wild.ambushPermille, luck))) return null;
    const foes = guards(cfg.encounter, rows, rng, groupCap);
    return foes.length > 0 ? foes : null;
  }
}
