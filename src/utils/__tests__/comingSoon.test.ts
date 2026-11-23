// Run with:  npm run test:utils
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanComingSoon } from '../comingSoon.ts';

test('a good list passes through', () => {
  const item = { key: 'calls', title: 'Calls', description: 'Voice calls.', icon: 'call', eta: 'Next term' };
  assert.deepEqual(cleanComingSoon([item]), [item]);
});

test('anything that is not a list is an empty list, and bad entries are skipped', () => {
  for (const raw of [null, undefined, 'x', 5, {}, { title: 'x' }]) assert.deepEqual(cleanComingSoon(raw), []);
  assert.deepEqual(cleanComingSoon([null, 'x', 5, [], {}, { title: '   ' }, { description: 'no title' }]), []);
});

test('text is trimmed and capped; a missing key, icon, description or eta gets a safe value', () => {
  const [a] = cleanComingSoon([{ title: ' ' + 'T'.repeat(100), description: 'D'.repeat(500), eta: 'E'.repeat(99), icon: 'I'.repeat(99) }]);
  assert.equal(a.title.length, 60);
  assert.equal(a.description.length, 200);
  assert.equal(a.eta!.length, 30);
  assert.equal(a.icon.length, 32);
  assert.ok(a.key.length > 0);
  const [b] = cleanComingSoon([{ title: 'Plain' }]);
  assert.deepEqual(b, { key: 'Plain', title: 'Plain', description: '', icon: '', eta: null });
});

test('at most 12 items', () => {
  assert.equal(cleanComingSoon(Array.from({ length: 40 }, (_, i) => ({ key: 'k' + i, title: 'T' + i }))).length, 12);
});
