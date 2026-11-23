// Run with:  npm run test:utils
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNotificationEvent,
  parseCountEvent,
  parseMessageEvent,
  socketOrigin,
  isInConversation,
  copyForNotification,
  copyForMessage,
} from '../realtimeEvents.ts';

const good = {
  id: '64b0000000000000000000a1',
  type: 'post_like',
  category: 'activity',
  title: 'Amina liked your post',
  message: 'Nice one',
  link: '/post/64b0000000000000000000b2',
  createdAt: '2026-11-22T10:00:00.000Z',
  actorName: 'Amina',
  actorAvatarUrl: 'https://img.example/a.png',
};

test('a good notification event is accepted as it is', () => {
  assert.deepEqual(parseNotificationEvent(good), good);
});

test('anything that is not an object, or has no type or title, is refused', () => {
  for (const raw of [null, undefined, 'x', 5, [], [good], {}, { type: 'post_like' }, { title: 'x' }, { type: '', title: 'x' }, { type: 'x', title: '   ' }]) {
    assert.equal(parseNotificationEvent(raw), null, JSON.stringify(raw));
  }
});

test('text is plain and capped: control characters become spaces, markup stays harmless text', () => {
  const n = parseNotificationEvent({ ...good, title: 'A\u0000B\nC ' + 'x'.repeat(500), message: '<script>x</script>' });
  assert.ok(n);
  assert.equal(n.title.startsWith('A B C x'), true);
  assert.equal(n.title.length, 140);
  assert.equal(n.message, '<script>x</script>');
});

test('a link must be an app path: web addresses and protocol-relative links are dropped', () => {
  assert.equal(parseNotificationEvent({ ...good, link: 'https://evil.example/x' })?.link, '');
  assert.equal(parseNotificationEvent({ ...good, link: '//evil.example/x' })?.link, '');
  assert.equal(parseNotificationEvent({ ...good, link: 'javascript:alert(1)' })?.link, '');
  assert.equal(parseNotificationEvent({ ...good, link: '/messages/64b0000000000000000000a1' })?.link, '/messages/64b0000000000000000000a1');
});

test('only https photos are kept; an odd id or category is cleared, not trusted', () => {
  assert.equal(parseNotificationEvent({ ...good, actorAvatarUrl: 'http://x/a.png' })?.actorAvatarUrl, null);
  assert.equal(parseNotificationEvent({ ...good, actorAvatarUrl: 'file:///etc/passwd' })?.actorAvatarUrl, null);
  assert.equal(parseNotificationEvent({ ...good, id: '../../x' })?.id, null);
  assert.equal(parseNotificationEvent({ ...good, id: { $ne: 1 } })?.id, null);
  assert.equal(parseNotificationEvent({ ...good, category: 'admin' })?.category, '');
  assert.equal(parseNotificationEvent({ ...good, actorName: '' })?.actorName, null);
});

test('count events: numbers are cleaned, missing tabs are zero, a bad shape is refused', () => {
  assert.deepEqual(parseCountEvent({ unreadCount: 3, counts: { all: 3, followers: 1, activity: 2, mentions: 0, updates: 0 } }), {
    unreadCount: 3,
    counts: { all: 3, followers: 1, activity: 2, mentions: 0, updates: 0 },
  });
  assert.deepEqual(parseCountEvent({ counts: { all: 7, followers: -4, activity: '5', mentions: NaN, updates: 123456 } }), {
    unreadCount: 7,
    counts: { all: 7, followers: 0, activity: 0, mentions: 0, updates: 9999 },
  });
  for (const raw of [null, 'x', 5, {}, { counts: 'x' }, { counts: [] }]) assert.equal(parseCountEvent(raw), null, JSON.stringify(raw));
});

test('message events need three real ids; the preview is plain and short', () => {
  const m = { conversationId: 'c0000000000000000000001', messageId: 'm0000000000000000000001', senderId: 's0000000000000000000001', preview: 'hello\nthere', createdAt: 't' };
  assert.deepEqual(parseMessageEvent(m), { ...m, preview: 'hello there' });
  for (const bad of [{ ...m, conversationId: '../x' }, { ...m, messageId: '' }, { ...m, senderId: { $ne: 1 } }, null, 'x', {}]) assert.equal(parseMessageEvent(bad), null);
  assert.equal(parseMessageEvent({ ...m, preview: 'x'.repeat(500) })?.preview.length, 120);
});

test('the socket lives at the API origin, without the /api part', () => {
  assert.equal(socketOrigin('https://unilink-backend-1.onrender.com/api'), 'https://unilink-backend-1.onrender.com');
  assert.equal(socketOrigin('https://x.example/api/'), 'https://x.example');
  assert.equal(socketOrigin(' http://localhost:5000/api '), 'http://localhost:5000');
  assert.equal(socketOrigin('https://x.example'), 'https://x.example');
});

test('a message banner is skipped only while that same chat is open', () => {
  assert.equal(isInConversation('/chat/abc123', 'abc123'), true);
  assert.equal(isInConversation('/chat/abc123/', 'abc123'), true);
  assert.equal(isInConversation('/chat/other1', 'abc123'), false);
  assert.equal(isInConversation('/home', 'abc123'), false);
  assert.equal(isInConversation(null, 'abc123'), false);
  assert.equal(isInConversation(undefined, 'abc123'), false);
});

test('banner wording: the person who did it is named once, and a message says only what the push says', () => {
  const n = parseNotificationEvent({ ...good, title: 'Liked your post' })!;
  assert.deepEqual(copyForNotification(n), { title: 'Amina: Liked your post', body: 'Nice one' });
  assert.equal(copyForNotification(parseNotificationEvent(good)!).title, 'Amina liked your post', 'not "Amina: Amina liked ..."');
  assert.equal(copyForNotification(parseNotificationEvent({ ...good, actorName: null })!).title, 'Amina liked your post');
  assert.deepEqual(copyForMessage({ conversationId: 'c', messageId: 'm', senderId: 's', preview: '', createdAt: '' }), { title: 'New message', body: 'You have a new message.' });
});
