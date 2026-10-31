import { ITEM_NAME_PREFIX, NODE_NAME_PREFIX } from '../db/startup_check.ts';
import { loadEntityState } from '../data/entity_load.ts';
import { saveGear } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { corruptionShare, isDark } from '../field/nodes.ts';
import type { ResourceNode } from '../field/types.ts';
import type { GameWorld } from '../game/world.ts';
import { addMoveExp, progressStats } from '../growth/level_up.ts';
import { addItem } from '../inventory/bag.ts';
import { badChance, rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import type { Foe } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import type { GatherNotice } from '../../shared/field.ts';
import { guards, rollFinds, toolMult } from './gather.ts';
import { nodeTable, takeNode } from './gather_repo.ts';

// Working a node from the field: tool check, one use taken (shared, in the same transaction as the finds and the
// skill exp), finds into the bag. The first time teaches the life skill. A dark node may then be guarded: an
// ambush by the field's corrupted creatures (the field room starts the battle).

export type GatherCtx = { world: GameWorld; rng: Rng; ref: string };
export type GatherOutcome = { notice: GatherNotice; foes: Foe[] | null };

// Line pools the gathering speaks from (checked at startup). Node names: NODE_NAME_PREFIX + kind.
export const GATHER_LINE_KEYS = ['ask.node', 'ask.node_dark', 'gather.found', 'gather.nothing', 'gather.empty', 'gather.no_tool', 'gather.learned'];

const line = (c: GatherCtx, key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;
const said = (c: GatherCtx, key: string): GatherOutcome => ({ notice: { text: line(c, key), finds: [] }, foes: null });

export const nodeIsDark = (node: ResourceNode, rows: PopRow[]) => isDark(node, corruptionShare(rows));

export async function gatherAt(c: GatherCtx, entityId: string, node: ResourceNode, rows: PopRow[], groupCap: number): Promise<GatherOutcome> {
  const { cfg } = c.world.data;
  const kind = cfg.gather.kinds[node.kind];
  const move = kind ? c.world.data.moves.get(kind.move) : undefined;
  if (!kind || !move) return said(c, 'gather.nothing');
  const [state, inv] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  const mult = toolMult(kind, c.world.catalog, inv);
  if (mult === null) return said(c, 'gather.no_tool');

  const { progress } = state;
  const learned = !progress.moves.has(kind.move);
  if (learned) progress.moves.set(kind.move, { level: 1, exp: 0 });
  const luck = progressStats(progress).luck;
  const dark = nodeIsDark(node, rows);
  const entries = c.world.nodeLoot.get(nodeTable(node.kind, dark)) ?? [];
  const finds = rollFinds(cfg.gather, cfg.luck, entries, progress.moves.get(kind.move)!.level, mult, luck, c.rng);
  for (const f of finds) addItem(c.world.catalog, inv, f.item, f.qty);
  addMoveExp(progress, kind.move, kind.exp, { statExp: move.statExp, expScaling: move.expScaling, tier: move.tier, tags: move.tags }, cfg);
  const took = await saveGear(c.world.pool, entityId, inv, progress, (client) => takeNode(client, c.ref, node.id, node.kind, kind.uses));
  if (!took) return said(c, 'gather.empty');

  const name = (item: string) => c.world.data.lines.pick(c.rng, ITEM_NAME_PREFIX + item)?.text ?? item;
  const notice: GatherNotice = {
    text: line(c, learned ? 'gather.learned' : finds.length > 0 ? 'gather.found' : 'gather.nothing'),
    finds: finds.map((f) => ({ name: name(f.item), qty: f.qty })),
  };
  const ambush = dark && rollPermille(c.rng, badChance(cfg.luck, cfg.gather.guardPermille, luck));
  const foes = ambush ? guards(cfg.encounter, rows, c.rng, groupCap) : [];
  return { notice, foes: foes.length > 0 ? foes : null };
}
