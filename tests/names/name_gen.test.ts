import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyOf, rollFamily, rollName, type NamePools } from '../../server/names/name_gen.ts';
import { createRng } from '../../server/util/rng.ts';

const pools: NamePools = new Map([
  ['human', { male: ['Aldric', 'Bram'], female: ['Adela', 'Brenna'], last: ['Ashford', 'Baker', 'Cole'] }],
  ['dwarf', { male: ['Balin'], female: ['Astrid'], last: ['Ironfist'] }],
]);

test('an ordinary NPC has a first and a last name, by sex and race', () => {
  const rng = createRng(1);
  for (let i = 0; i < 50; i++) {
    const m = rollName(pools, 'human', 'male', false, rng)!.split(' ');
    assert.equal(m.length, 2);
    assert.ok(['Aldric', 'Bram'].includes(m[0]));
    const f = rollName(pools, 'dwarf', 'female', false, rng);
    assert.equal(f, 'Astrid Ironfist');
  }
});

test('only a notable has a middle name, and the heir keeps it with the last name', () => {
  const rng = createRng(2);
  for (let i = 0; i < 50; i++) {
    const notable = rollName(pools, 'human', 'female', true, rng)!;
    const fam = familyOf(notable)!;
    assert.ok(fam.middle, notable);
    const heir = rollName(pools, 'human', 'male', false, rng, fam)!;
    assert.deepEqual(familyOf(heir), fam);
    assert.notEqual(heir.split(' ')[0], fam.middle); // never the same word twice
  }
});

test('an heir of a plain family has no middle name; an unknown race borrows human names; no pools gives nothing', () => {
  const rng = createRng(3);
  assert.equal(familyOf('Bram Baker')!.middle, null);
  assert.equal(familyOf('Bram Baker Cole'.split(' ').slice(0, 1).join(' ')), null);
  assert.ok(rollName(pools, 'elf', 'male', false, rng));
  assert.equal(rollName(new Map(), 'human', 'male', false, rng), null);
  assert.equal(rollFamily(pools, 'human', false, rng)!.middle, null);
});
