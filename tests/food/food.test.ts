import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityCost } from '../../server/battle/rules.ts';
import { canEat, mealActive, mealCosts, mealEnds } from '../../server/food/food.ts';
import { parseItem } from '../../server/inventory/items.ts';
import { cfg, fighter, MOVES } from '../fixtures/battle_data.ts';

const grilled = parseItem('grilled_chicken', 'food', 'meat', null, { weight: 0.4, edible: true, meal: { stamina_cost: 0.95 } });
const tainted = parseItem('tainted_meat', 'food', 'meat', null, { weight: 0.8, edible: false });

test('a meal lasts the configured time from when it was eaten, no timer', () => {
  const meal = { item: 'grilled_chicken', eatenAt: 1_000_000 };
  const ends = mealEnds(cfg, meal);
  assert.equal(ends - meal.eatenAt, cfg.food.durationMinutes * 60_000 * cfg.worldTimeScale);
  assert.ok(mealActive(cfg, meal, ends - 1));
  assert.ok(!mealActive(cfg, meal, ends));
  assert.ok(!mealActive(cfg, null, 0));
});

test('only edible food can be eaten; its hidden effect only touches costs it names', () => {
  assert.ok(canEat(grilled));
  assert.ok(!canEat(tainted));
  assert.ok(!canEat(undefined));
  assert.deepEqual(mealCosts(grilled), { stamina: 0.95, mana: 1 });
  assert.deepEqual(mealCosts(tainted), { stamina: 1, mana: 1 });
});

test('in battle a meal lowers what moves cost; without one nothing changes', () => {
  const punch = MOVES.get('punch')!;
  const plain = fighter('p', 'party');
  const fed = fighter('f', 'party');
  fed.costMult = mealCosts(grilled);
  const base = entityCost(cfg, plain, punch).cost;
  assert.ok(base > 0);
  assert.equal(entityCost(cfg, fed, punch).cost, base * 0.95);
});
