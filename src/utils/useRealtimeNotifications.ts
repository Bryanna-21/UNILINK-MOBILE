import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useRealtimeStore } from '../store/realtimeStore';
import { connectRealtime, disconnectRealtime, isRealtimeConnected } from '../realtime/socket';
import { isCategoryMuted } from './notificationPrefs';
import { routeForNotification } from './notificationRouting';
import {
  copyForMessage,
  copyForNotification,
  isInConversation,
  parseCountEvent,
  parseMessageEvent,
  parseNotificationEvent,
} from './realtimeEvents';

// Mounted once in app/_layout.tsx. While the app is open and someone is signed in, notifications arrive live: the badge
// moves, the Notifications list refreshes, and a small banner appears (unless that kind is muted in Settings).
//
// When the app is in the background the connection is closed and the normal push notifications take over, exactly as
// before. A sign-out, or "sign out of all devices", ends the connection (the server also closes it).
export function useRealtimeNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const store = useRealtimeStore.getState;
    if (!userId) {
      disconnectRealtime();
      store().reset();
      return;
    }

    let cancelled = false;

    // The server's own numbers, used when we connect, reconnect or come back to the app, so a missed event never
    // leaves a wrong badge. A dead session shows up here as a 401, which signs the person out the usual way.
    const refreshCounts = async () => {
      try {
        const res = await api.get('/notifications');
        const parsed = parseCountEvent({ unreadCount: res.data?.unreadCount, counts: res.data?.counts });
        if (parsed && !cancelled) store().setCounts(parsed);
      } catch {
        // Live is a bonus: a failed refresh is not worth bothering anyone about.
      }
    };

    const start = async () => {
      if (cancelled || isRealtimeConnected()) return;
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync('unilink_token');
      } catch {
        return;
      }
      if (cancelled || !token) return;

      const socket = connectRealtime(token);
      socket.on('connect', () => {
        store().setConnected(true);
        refreshCounts();
      });
      socket.on('disconnect', (reason: string) => {
        store().setConnected(false);
        if (reason === 'io server disconnect') refreshCounts(); // the server ended it: find out why (a dead session signs out)
      });
      socket.on('connect_error', () => store().setConnected(false));

      socket.on('notification:new', async (raw: unknown) => {
        const n = parseNotificationEvent(raw);
        if (!n) return;
        store().notificationArrived();
        const onList = (pathnameRef.current || '').startsWith('/notifications');
        if (onList || (await isCategoryMuted(n.type))) return;
        const copy = copyForNotification(n);
        store().showBanner({
          title: copy.title,
          body: copy.body,
          route: routeForNotification({ type: n.type, link: n.link }),
          notificationId: n.id,
        });
      });

      socket.on('notification:count', (raw: unknown) => {
        const c = parseCountEvent(raw);
        if (c) store().setCounts(c);
      });

      socket.on('message:new', async (raw: unknown) => {
        const m = parseMessageEvent(raw);
        if (!m) return;
        store().messageArrived(m);
        if (isInConversation(pathnameRef.current, m.conversationId) || (await isCategoryMuted('new_message'))) return;
        const copy = copyForMessage(m);
        store().showBanner({ title: copy.title, body: copy.body, route: `/chat/${m.conversationId}`, notificationId: null });
      });
    };

    const stop = () => {
      disconnectRealtime();
      store().setConnected(false);
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        start();
        refreshCounts();
      } else {
        stop(); // in the background the push notifications cover it
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      stop();
    };
  }, [userId]);
}
