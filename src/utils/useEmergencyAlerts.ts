import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { emergencyAlertRoute } from './emergencyAlert';

// While UniLink is open, an emergency alert that rings opens its screen straight away (with the
// vibration), instead of waiting for you to notice a banner. When the app is closed or in the
// background the phone's own notification rings, and tapping it opens the same screen
// (useNotificationTapRouting). Does nothing until the person is signed in.
export function useEmergencyAlerts() {
  const signedIn = useAuthStore((s) => !!s.user);
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!signedIn || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    let removed = false;
    let subscription: { remove: () => void } | null = null;

    import('expo-notifications')
      .then((N) => {
        if (removed) return;
        subscription = N.addNotificationReceivedListener((notification: any) => {
          const data = notification?.request?.content?.data;
          if (!data || data.type !== 'emergency_alert' || data.ring !== '1') return;
          const reportId = typeof data.reportId === 'string' ? data.reportId : '';
          if (!reportId || shown.current.has(reportId)) return;
          const route = emergencyAlertRoute(data);
          if (!route) return;
          shown.current.add(reportId);
          try {
            router.push(route as any);
          } catch {
            // never crash the app over a bad alert
          }
        });
      })
      .catch(() => {});

    return () => {
      removed = true;
      subscription?.remove();
    };
  }, [signedIn]);
}
