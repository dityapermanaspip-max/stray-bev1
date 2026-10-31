import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFighting, startFighting, stopFighting, withEntity } from '../../server/util/entity_lock.ts';

const tick = () => new Promise((r) => setTimeout(r, 5));

test('two actions for one player run one after the other, so the second sees the first one saved', async () => {
  let saved = 1; // one jerkin in the bag
  let paid = 0;
  const sell = () => withEntity('p1', async () => {
    const bag = saved; // load
    await tick();
    if (bag < 1) return 'nothing';
    saved = bag - 1; // save
    paid += 42;
    return 'sold';
  });
  assert.deepEqual(await Promise.all([sell(), sell()]), ['sold', 'nothing']);
  assert.equal(paid, 42);
});

test('a failed action does not block the next, and other players are not held up', async () => {
  const order: string[] = [];
  const failed = withEntity('p2', async () => { await tick(); throw new Error('boom'); });
  const other = withEntity('p3', () => order.push('p3'));
  const next = withEntity('p2', () => order.push('p2'));
  await assert.rejects(failed);
  await Promise.all([other, next]);
  assert.deepEqual(order, ['p3', 'p2']);
});

test('fighting marks a player until the battle clears it', () => {
  startFighting('p4');
  assert.equal(isFighting('p4'), true);
  stopFighting('p4');
  assert.equal(isFighting('p4'), false);
});
