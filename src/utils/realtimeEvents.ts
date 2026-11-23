// Pure rules for the live events the server sends over Socket.IO (no React, no network: unit-tested in
// src/utils/__tests__/realtimeEvents.test.ts). Everything that arrives is treated as untrusted and cleaned here, so a
// malformed or hostile event can never crash the app, show markup, or send the person somewhere unexpected.

export type LiveCategory = 'all' | 'followers' | 'activity' | 'mentions' | 'updates';
export type LiveCounts = Record<LiveCategory, number>;
export const NO_LIVE_COUNTS: LiveCounts = { all: 0, followers: 0, activity: 0, mentions: 0, updates: 0 };

export interface LiveNotification {
  id: string | null;
  type: string;
  category: LiveCategory | '';
  title: string;
  message: string;
  link: string;
  createdAt: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
}
export interface LiveCountEvent {
  unreadCount: number;
  counts: LiveCounts;
}
export interface LiveMessage {
  conversationId: string;
  messageId: string;
  senderId: string;
  preview: string;
  createdAt: string;
}

const ID = /^[A-Za-z0-9_-]{6,64}$/;
const CATEGORIES: LiveCategory[] = ['all', 'followers', 'activity', 'mentions', 'updates'];
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Plain one-line text, control characters removed, capped.
function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function count(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 9999) : 0;
}

export function parseNotificationEvent(raw: unknown): LiveNotification | null {
  if (!isObject(raw)) return null;
  const type = text(raw.type, 40);
  const title = text(raw.title, 140);
  if (!type || !title) return null;
  const category = typeof raw.category === 'string' && (CATEGORIES as string[]).includes(raw.category) ? (raw.category as LiveCategory) : '';
  const link = typeof raw.link === 'string' && raw.link.startsWith('/') && !raw.link.startsWith('//') ? raw.link.slice(0, 200) : '';
  const avatar = typeof raw.actorAvatarUrl === 'string' && /^https:\/\//i.test(raw.actorAvatarUrl) ? raw.actorAvatarUrl.slice(0, 500) : null;
  return {
    id: typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : null,
    type,
    category,
    title,
    message: text(raw.message, 240),
    link,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '',
    actorName: text(raw.actorName, 80) || null,
    actorAvatarUrl: avatar,
  };
}

export function parseCountEvent(raw: unknown): LiveCountEvent | null {
  if (!isObject(raw) || !isObject(raw.counts)) return null;
  const counts = { ...NO_LIVE_COUNTS };
  for (const key of CATEGORIES) counts[key] = count((raw.counts as Record<string, unknown>)[key]);
  return { unreadCount: raw.unreadCount === undefined ? counts.all : count(raw.unreadCount), counts };
}

export function parseMessageEvent(raw: unknown): LiveMessage | null {
  if (!isObject(raw)) return null;
  const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : '';
  const messageId = typeof raw.messageId === 'string' ? raw.messageId : '';
  const senderId = typeof raw.senderId === 'string' ? raw.senderId : '';
  if (!ID.test(conversationId) || !ID.test(messageId) || !ID.test(senderId)) return null;
  return { conversationId, messageId, senderId, preview: text(raw.preview, 120), createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : '' };
}

// The socket lives at the API's origin: the same address without the trailing /api.
export function socketOrigin(apiBase: string): string {
  return String(apiBase).trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

// A banner for a message is pointless while that very chat is open.
export function isInConversation(pathname: string | null | undefined, conversationId: string): boolean {
  return typeof pathname === 'string' && pathname.replace(/\/+$/, '') === `/chat/${conversationId}`;
}

export interface BannerCopy {
  title: string;
  body: string;
}
export function copyForNotification(n: LiveNotification): BannerCopy {
  return { title: n.actorName && !n.title.includes(n.actorName) ? `${n.actorName}: ${n.title}` : n.title, body: n.message };
}
export function copyForMessage(m: LiveMessage): BannerCopy {
  return { title: 'New message', body: m.preview || 'You have a new message.' };
}
