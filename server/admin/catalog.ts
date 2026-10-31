import type pg from 'pg';
import { loadEntityState } from '../data/entity_load.ts';
import { loadInventory } from '../data/item_repo.ts';
import { armorDefense, fitsSlot, itemWeight } from '../inventory/items.ts';
import { STATS } from '../stats/derived.ts';
import type { LabWorld } from './lab_battle.ts';
import type { LabFighter } from './lab_types.ts';

// What the lab's dropdowns offer. Admin only, so unlock rules and hidden tags are included.

const TREE = 'tree:';
const BRANCH = 'branch:';

export async function buildCatalog(pool: pg.Pool, world: LabWorld) {
  const { data } = world;
  const name = (move: string) => data.lines.pick(() => 0, `move_name_${move}`)?.text ?? move;
  const unlocks = new Map<string, string[]>();
  for (const u of data.unlocks) {
    const p = u.params;
    const text = u.kind === 'trainer' ? `trainer ${p.trainer_tag}` : u.kind === 'scroll' ? 'scroll' : `${p.move} ${p.level}`;
    unlocks.set(u.move, [...(unlocks.get(u.move) ?? []), `${u.group}: ${u.kind} ${text}`]);
  }
  const players = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM entity.entities WHERE kind = 'player' AND alive ORDER BY name",
  );

  return {
    stats: STATS,
    limits: { loadoutSlots: data.cfg.loadoutSlots, moveLevelCap: data.cfg.moveLevelCap },
    humanStart: { stats: data.cfg.playerStartStats, moves: data.cfg.playerStartMoves },
    moves: [...data.moves.values()]
      .map((m) => ({
        name: m.name,
        label: name(m.name),
        category: m.category,
        target: m.target,
        tree: m.tags.find((t) => t.startsWith(TREE))?.slice(TREE.length) ?? null,
        branch: m.tags.find((t) => t.startsWith(BRANCH))?.slice(BRANCH.length) ?? null,
        requires: m.requires.map((r) => `${r.kind} ${r.value}${r.amount === null ? '' : ` ${r.amount}`}`),
        unlock: unlocks.get(m.name) ?? [],
      }))
      .sort((a, b) => (a.tree ?? '~').localeCompare(b.tree ?? '~') || (a.branch ?? '').localeCompare(b.branch ?? '') || a.label.localeCompare(b.label)),
    species: [...world.species.values()].map((s) => ({ name: s.name, stats: s.baseStats, moves: s.moves, bodyParts: s.bodyParts })),
    players: players.rows,
    gearSlots: data.cfg.gear.slots,
    items: [...world.catalog.values()]
      .map((i) => ({
        name: i.name,
        label: data.lines.pick(() => 0, `item_name_${i.name}`)?.text ?? i.name,
        type: i.type,
        fits: fitsSlot(i),
        stack: i.stack,
        material: i.material?.name ?? null,
        weight: Math.round(itemWeight(data.cfg, i) * 100) / 100,
        defense: Math.round(armorDefense(data.cfg, i) * 100) / 100,
        wield: i.wield,
        quality: i.defaultQuality,
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label)),
  };
}

// A saved player as a lab fighter (sandbox copy; the lab never writes it back).
export async function playerFighter(pool: pg.Pool, id: string): Promise<LabFighter> {
  const [s, inv] = await Promise.all([loadEntityState(pool, id), loadInventory(pool, id)]);
  const equipped = new Set(s.loadout.values());
  return {
    label: s.name,
    source: 'human',
    species: null,
    stats: Object.fromEntries(STATS.map((k) => [k, s.progress.stats[k].base])) as LabFighter['stats'],
    moves: [...s.progress.moves].map(([name, k]) => ({ name, level: k.level, equipped: equipped.has(name) })),
    row: 'front',
    corrupted: false,
    count: 1,
    gear: [
      ...inv.pieces.map((p) => ({ item: p.item, qty: 1, slot: p.slot })),
      ...[...inv.stacks.values()].map((st) => ({ item: st.item, qty: st.qty, slot: st.slot })),
    ],
  };
}
