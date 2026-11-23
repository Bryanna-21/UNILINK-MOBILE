import { create } from 'zustand';
import type { LiveCountEvent, LiveCounts, LiveMessage } from '../utils/realtimeEvents';

// What the live channel (src/utils/useRealtimeNotifications.ts) tells the rest of the app. Screens read from here instead
// of opening their own connections: the bell badge, the Notifications list, the Messages list and the in-app banner.
export interface LiveBanner {
  key: number;
  title: string;
  body: string;
  route: string | null;
  notificationId: string | null;
}

interface RealtimeState {
  connected: boolean;
  unreadCount: number | null; // null until the server has told us
  counts: LiveCounts | null;
  notificationTick: number; // goes up whenever a notification arrives or the counts change: screens reload on it
  messageTick: number;
  lastMessage: LiveMessage | null;
  banner: LiveBanner | null;
  setConnected: (connected: boolean) => void;
  setCounts: (event: LiveCountEvent) => void;
  notificationArrived: () => void;
  messageArrived: (message: LiveMessage) => void;
  showBanner: (banner: Omit<LiveBanner, 'key'>) => void;
  dismissBanner: () => void;
  reset: () => void;
}

let bannerKey = 0;

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  unreadCount: null,
  counts: null,
  notificationTick: 0,
  messageTick: 0,
  lastMessage: null,
  banner: null,
  setConnected: (connected) => set({ connected }),
  setCounts: (event) => set((s) => ({ unreadCount: event.unreadCount, counts: event.counts, notificationTick: s.notificationTick + 1 })),
  notificationArrived: () => set((s) => ({ notificationTick: s.notificationTick + 1 })),
  messageArrived: (message) => set((s) => ({ lastMessage: message, messageTick: s.messageTick + 1 })),
  showBanner: (banner) => set({ banner: { ...banner, key: ++bannerKey } }),
  dismissBanner: () => set({ banner: null }),
  reset: () => set({ connected: false, unreadCount: null, counts: null, banner: null, lastMessage: null }),
}));
