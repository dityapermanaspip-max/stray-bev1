import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBalance } from '../../server/config/balance.ts';
import { findViceProblems } from '../../server/config/world_config.ts';
import { isFighting, stopFighting } from '../../server/util/entity_lock.ts';
import { forgetVice, setViceIn, viceIn, withVice } from '../../server/vice/vice_finder.ts';
import { rollViceMoves } from '../../server/vice/vice_moves.ts';
import { RAW_CONFIG } from '../fixtures/battle_data.ts';

const raw = new Map(RAW_CONFIG);
raw.set('vice', { ...(RAW_CONFIG.get('vice') as object), race: 'fiend', budget_bonus: 40, moves: { str: ['punch', 'kick', 'jab'] } });
const cfg = buildBalance(raw);

test('a vice rolls only its type list, all open, with its ring budget plus the bonus', () => {
  const moves = rollViceMoves(cfg, 'str', 1, () => 0.5);
  assert.ok(moves.every((m) => ['punch', 'kick', 'jab'].includes(m.name)));
  const total = moves.reduce((n, m) => n + m.level, 0);
  const cap = moves.length * cfg.creatureGen.maxMoveLevel;
  assert.equal(total, Math.min(cap, cfg.creatureGen.moveBudget.get(1)! + 40));
  assert.ok(moves.filter((m) => m.equipped).length <= cfg.loadoutSlots);
});

test('vice config check: missing types and unknown moves', () => {
  const problems = findViceProblems(cfg.vice, new Set(['punch', 'kick']));
  assert.ok(problems.includes('vice str: unknown move jab'));
  assert.ok(problems.includes('vice dex: no moves'));
});

test('an encounter in a vice hex can become the vice alone; never one already fighting', () => {
  const foes = [{ species: 'cat', corrupted: false }];
  setViceIn('hex1', { id: 'v1', type: 'str' });
  assert.deepEqual(withVice('hex2', foes, 1000, () => 0), foes); // no vice there
  assert.equal(withVice('hex1', null, 1000, () => 0), null); // no encounter, no vice
  assert.deepEqual(withVice('hex1', foes, 0, () => 0.5), foes); // the roll missed
  const met = withVice('hex1', foes, 1000, () => 0);
  assert.deepEqual(met, [{ species: 'vice', corrupted: true, vice: { id: 'v1', type: 'str' } }]);
  assert.ok(isFighting('v1'));
  assert.deepEqual(withVice('hex1', foes, 1000, () => 0), foes); // busy with someone else
  stopFighting('v1');
  forgetVice('v1');
  assert.equal(viceIn('hex1'), null);
});
