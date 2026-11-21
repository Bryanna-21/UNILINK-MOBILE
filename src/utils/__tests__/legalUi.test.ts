// Run with:  npm run test:utils   (Node's built-in test runner; no extra packages)
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkify, needsGate, formatDate } from '../legalUi.ts';

test('plain text stays one piece', () => {
  assert.deepEqual(linkify('Hello there'), [{ type: 'text', value: 'Hello there' }]);
});

test('an https link becomes a tappable piece, and trailing punctuation is not part of it', () => {
  assert.deepEqual(linkify('See https://odpc.go.ke/complaints. Thanks'), [
    { type: 'text', value: 'See ' },
    { type: 'link', value: 'https://odpc.go.ke/complaints' },
    { type: 'text', value: '. Thanks' },
  ]);
  assert.deepEqual(linkify('(https://a.example/x)'), [
    { type: 'text', value: '(' },
    { type: 'link', value: 'https://a.example/x' },
    { type: 'text', value: ')' },
  ]);
});

test('only https links are made tappable: http, javascript and mailto stay as text', () => {
  for (const bad of ['http://a.example', 'javascript:alert(1)', 'mailto:a@b.co', 'ftp://x']) {
    assert.deepEqual(linkify(bad), [{ type: 'text', value: bad }]);
  }
});

test('several links and empty or missing input are handled', () => {
  assert.equal(linkify('https://a.example and https://b.example').filter((p) => p.type === 'link').length, 2);
  assert.deepEqual(linkify(''), []);
  assert.deepEqual(linkify(null), []);
  assert.deepEqual(linkify(undefined), []);
});

test('the gate shows only when the server says so, and never because the status failed to load', () => {
  assert.equal(needsGate({ currentVersion: '2', acknowledgedVersion: null, needsAcknowledgement: true }), true);
  assert.equal(needsGate({ currentVersion: '2', acknowledgedVersion: '2', needsAcknowledgement: false }), false);
  assert.equal(needsGate(null), false);
  assert.equal(needsGate(undefined), false);
  assert.equal(needsGate({ needsAcknowledgement: 'yes' } as never), false);
});

test('dates are readable, and a bad or missing date is an empty string', () => {
  assert.equal(formatDate('2026-11-14T10:00:00Z'), '14 November 2026');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(null), '');
  assert.equal(formatDate('not a date'), '');
});
