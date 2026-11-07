import type { BattleEntity, BattleEvent } from '../../battle/types.ts';
import { equippedMoves } from '../../loadout/loadout.ts';
import type { LinePicker } from '../../presentation/line_picker.ts';
import type { Rng } from '../../util/rng.ts';
import type { Figure } from '../../config/world_config.ts';
import { VICE_NAME } from '../../vice/vice_check.ts';
import { BOSS_NAME } from '../../db/startup_check.ts';
import type { BattleEventView, BattleFighter, BattleView, Word } from '../../../shared/battle.ts';
import type { Fight } from './battle_setup.ts';

// What the player's client sees of a battle: names, body-state tiers with their words, damage and heal numbers,
// sentences. Foes show health only; no stats, gauges or exp ever leave the server.

export const MOVE_NAME = 'move_name_';
export const SPECIES_NAME = 'species_name_';
export const BODY_WORD = 'body_word.';

export type Words = {
  lines: LinePicker; rng: Rng; moves: ReadonlyMap<string, { target: string; rowRule?: string }>;
  figures?: { vice: Record<string, Figure>; boss: Figure | null }; // how vices and the boss are drawn
};

const named = (w: Words, key: string, fallback: string) => w.lines.pick(w.rng, key)?.text ?? fallback;
export const word = (w: Words, resource: string, tier: number): Word => ({ tier, text: w.lines.pick(w.rng, BODY_WORD + resource, tier)?.text ?? null });

function fighterName(w: Words, f: Fight, e: BattleEntity): string {
  if (e === f.player) return f.order.name;
  const mate = f.companions.find((c) => c.entity === e);
  if (mate) return mate.state.name; // a companion fought as themselves: their name, not a species line
  const foe = f.order.foes[f.foes.indexOf(e)];
  if (foe?.vice) return named(w, VICE_NAME + foe.vice.type, 'vice');
  if (foe?.boss) return named(w, BOSS_NAME, 'boss');
  const species = foe?.species ?? e.id;
  return named(w, SPECIES_NAME + species, species);
}

const figureOf = (w: Words, foe: Fight['order']['foes'][number] | undefined): Figure | null =>
  (foe?.vice ? w.figures?.vice[foe.vice.type] : foe?.boss ? w.figures?.boss : null) ?? null;

export function fighterView(w: Words, f: Fight, e: BattleEntity): BattleFighter {
  const you = e === f.player;
  const foe = f.order.foes[f.foes.indexOf(e)];
  return {
    id: e.id, side: e.side, slot: e.slot, row: e.row, name: fighterName(w, f, e), you, corrupted: e.corrupted, look: foe && !foe.vice && !foe.boss ? foe.species : null, figure: figureOf(w, foe), downed: e.hp <= 0,
    hp: word(w, 'hp', e.tiers.hp),
    stamina: you ? word(w, 'stamina', e.tiers.stamina) : null,
    mana: you ? word(w, 'mana', e.tiers.mana) : null,
  };
}

export const isReady = (f: Fight) => f.player.phase === 'ready' && !f.player.queued && f.instance.winner === null;

export function battleView(w: Words, f: Fight, slots: number, formation: { front: number; back: number }): BattleView {
  const entities = f.instance.entities;
  const all = new Set(entities.flatMap((e) => e.moves));
  const equipped = [...f.state.loadout].sort((a, b) => a[0] - b[0]);
  const moves = equipped
    .filter(([, move]) => f.player.moves.includes(move))
    .map(([slot, move]) => ({
      move, slot, name: named(w, MOVE_NAME + move, move), target: w.moves.get(move)?.target ?? 'one_enemy', front: w.moves.get(move)?.rowRule === 'front',
    }));
  return {
    you: f.player.id,
    fighters: entities.map((e) => fighterView(w, f, e)),
    slots,
    formation: { front: formation.front, back: formation.back },
    moves,
    moveNames: Object.fromEntries([...all, ...equippedMoves(f.state.loadout)].map((m) => [m, named(w, MOVE_NAME + m, m)])),
    ready: isReady(f),
    ground: f.ground,
  };
}

// Engine events -> what this player may see. Foes' stamina and mana tiers, and other fighters' learning, stay hidden.
export function eventsFor(w: Words, f: Fight, events: BattleEvent[]): BattleEventView[] {
  const you = f.player.id;
  const out: BattleEventView[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'use': case 'damage': case 'miss': case 'heal': case 'interrupt': case 'downed': case 'counter': case 'moved': case 'lock':
        out.push(e);
        break;
      case 'line':
        out.push({ type: 'line', entity: e.entity, text: e.text, expression: e.expression });
        break;
      case 'tier':
        if (e.resource === 'hp' || e.entity === you) out.push({ type: 'tier', entity: e.entity, resource: e.resource, word: word(w, e.resource, e.tier) });
        break;
      case 'learned':
        if (e.entity === you) out.push({ type: 'learned', move: e.move, name: named(w, MOVE_NAME + e.move, e.move) });
        break;
      case 'end':
        out.push({ type: 'end', won: e.winner === f.player.side });
        break;
    }
  }
  return out;
}
