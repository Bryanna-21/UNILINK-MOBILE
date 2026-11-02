import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router, usePathname } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useCallsAvailable } from './useCallsAvailable';

// While the app is open and signed in, ask the server every 4 seconds whether someone is calling,
// and open the call screen when they are. (When the app is closed, the push notification does the
// ringing, and tapping it opens the same screen.) Each call is opened once, and nothing is opened
// while a call screen is already showing.
const POLL_MS = 4000;

export function useIncomingCallWatcher() {
  const userId = useAuthStore((s) => s.user?.id);
  const available = useCallsAvailable();
  const pathname = usePathname();
  const opened = useRef<Set<string>>(new Set());
  const onCallScreen = useRef(false);
  onCallScreen.current = pathname.startsWith('/call/');

  useEffect(() => {
    if (!userId || !available) return undefined;
    let stopped = false;

    const check = async () => {
      if (stopped || AppState.currentState !== 'active' || onCallScreen.current) return;
      try {
        const res = await api.get('/calls/incoming');
        const next = (res.data?.data ?? []).find((c: { id: string }) => !opened.current.has(c.id));
        if (next && !stopped) {
          opened.current.add(next.id);
          router.push(`/call/${next.id}` as any);
        }
      } catch {
        // Offline or a hiccup: try again at the next tick.
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, available]);
}
