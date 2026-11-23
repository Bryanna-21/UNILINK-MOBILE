// Run with:  npm run test:utils
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShakeDetector, screenNameFromSegments } from '../shake.ts';

const REST = [0, 0, 1];
const HARD = [1.5, 1.5, 1.5]; // magnitude about 2.6 g

test('a phone at rest or moved gently never triggers', () => {
  const d = createShakeDetector();
  for (let t = 0; t < 10000; t += 100) assert.equal(d.push(REST[0], REST[1], REST[2], t), false);
  for (let t = 10000; t < 20000; t += 100) assert.equal(d.push(0.6, 0.6, 1.1, t), false); // about 1.4 g
});

test('one strong jolt is not a shake', () => {
  const d = createShakeDetector();
  assert.equal(d.push(...(HARD as [number, number, number]), 1000), false);
  assert.equal(d.push(0, 0, 1, 1100), false);
  assert.equal(d.push(0, 0, 1, 1200), false);
});

test('two strong spikes inside 800 ms are a shake, on the second spike', () => {
  const d = createShakeDetector();
  assert.equal(d.push(1.5, 1.5, 1.5, 1000), false);
  assert.equal(d.push(0, 0, 1, 1100), false);
  assert.equal(d.push(-1.5, 1.5, -1.5, 1300), true);
});

test('two spikes more than 800 ms apart are not a shake (a bump, then another much later)', () => {
  const d = createShakeDetector();
  assert.equal(d.push(1.5, 1.5, 1.5, 1000), false);
  assert.equal(d.push(1.5, 1.5, 1.5, 1900), false);
});

test('readings only a moment apart are one jolt, not two spikes', () => {
  const d = createShakeDetector();
  assert.equal(d.push(1.5, 1.5, 1.5, 1000), false);
  assert.equal(d.push(1.6, 1.4, 1.5, 1100), false); // 100 ms later: still the same jolt
  assert.equal(d.push(1.5, 1.5, 1.5, 1140), false); // 140 ms after the first spike: still the same jolt
});

test('after a shake there is a cooldown, then it works again', () => {
  const d = createShakeDetector();
  d.push(1.5, 1.5, 1.5, 1000);
  assert.equal(d.push(1.5, 1.5, 1.5, 1300), true);
  assert.equal(d.push(1.5, 1.5, 1.5, 1600), false);
  assert.equal(d.push(1.5, 1.5, 1.5, 1900), false);
  assert.equal(d.push(1.5, 1.5, 1.5, 6200), false); // 4.9 s after the shake: still cooling down, so this is ignored
  assert.equal(d.push(1.5, 1.5, 1.5, 6400), false); // cooldown over: the first spike of a new shake
  assert.equal(d.push(1.5, 1.5, 1.5, 6700), true);
});

test('the threshold can be changed, and nonsense readings are ignored', () => {
  const sensitive = createShakeDetector({ threshold: 1.2 });
  sensitive.push(0.8, 0.8, 0.8, 1000);
  assert.equal(sensitive.push(0.8, 0.8, 0.8, 1300), true);
  const d = createShakeDetector();
  assert.equal(d.push(NaN, 1, 1, 1000), false);
  assert.equal(d.push(Infinity, 1, 1, 1000), false);
  assert.equal(d.push(1, 1, 1, NaN), false);
});

test('reset forgets a half-finished shake and a cooldown', () => {
  const d = createShakeDetector();
  d.push(1.5, 1.5, 1.5, 1000);
  d.reset();
  assert.equal(d.push(1.5, 1.5, 1.5, 1300), false, 'the first spike no longer counts');
  assert.equal(d.push(1.5, 1.5, 1.5, 1500), true);
  d.reset();
  d.push(1.5, 1.5, 1.5, 1600);
  assert.equal(d.push(1.5, 1.5, 1.5, 1800), true, 'no cooldown left after reset');
});

test('screen names drop the (group) parts and anything odd', () => {
  assert.equal(screenNameFromSegments(['(tabs)', 'home']), 'home');
  assert.equal(screenNameFromSegments(['settings', 'report-problem']), 'settings/report-problem');
  assert.equal(screenNameFromSegments(['chat', '[id]']), 'chat/[id]');
  assert.equal(screenNameFromSegments([]), 'home');
  assert.equal(screenNameFromSegments(['a<b>', 'c"d']), 'ab/cd');
  assert.equal(screenNameFromSegments(['x'.repeat(200)]).length, 80);
});
