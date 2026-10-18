import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { routeForNotification } from './notificationRouting';

// Tapping a notification opens the screen it is about, whether the app was open, in the background,
// or closed. Does nothing until the person is signed in, then handles a tap that launched the app.
export function useNotificationTapRouting() {
  const signedIn = useAuthStore((s) => !!s.user);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    let removed = false;
    let subscription: { remove: () => void } | null = null;

    const open = (response: any) => {
      const id: string = response?.notification?.request?.identifier ?? '';
      if (id && handled.current === id) return; // the same tap must not navigate twice
      handled.current = id || null;
      try {
        router.push(routeForNotification(response?.notification?.request?.content?.data) as any);
      } catch {
        // A bad destination should never crash the app.
      }
    };

    import('expo-notifications')
      .then(async (N) => {
        if (removed) return;
        subscription = N.addNotificationResponseReceivedListener(open);
        const launch = await N.getLastNotificationResponseAsync();
        if (launch) open(launch);
      })
      .catch(() => {});

    return () => {
      removed = true;
      subscription?.remove();
    };
  }, [signedIn]);
}
