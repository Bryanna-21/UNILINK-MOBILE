import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { createShakeDetector, screenNameFromSegments } from './shake';
import { isShakeToReportEnabled, onShakePrefChange } from './shakePrefs';

const REPORT_ROUTE = 'settings/report-problem';

// Shake the phone to report a problem. Needs the expo-sensors native module, so it works in a build that includes it
// (and quietly does nothing in one that does not). Only listens while the app is open and the person is signed in,
// and only if the switch in Settings is on, so it costs nothing in the background.
export function useShakeToReport() {
  const signedIn = useAuthStore((s) => !!s.user);
  const segments = useSegments() as string[];
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    if (!signedIn || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    const detector = createShakeDetector();

    const openReport = () => {
      const name = screenNameFromSegments(segmentsRef.current);
      if (name === REPORT_ROUTE) return; // already there
      try {
        router.push({ pathname: '/settings/report-problem', params: { from: name } } as any);
      } catch {
        // Never crash the app over a shake.
      }
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
      detector.reset();
    };

    const start = async () => {
      if (cancelled || subscription || AppState.currentState !== 'active') return;
      if (!(await isShakeToReportEnabled()) || cancelled || subscription) return;
      try {
        const { Accelerometer } = await import('expo-sensors');
        if (cancelled || subscription) return;
        Accelerometer.setUpdateInterval(100);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (detector.push(x, y, z, Date.now())) openReport();
        });
      } catch {
        // This build has no motion sensor module: shake simply is not available.
      }
    };

    start();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    const prefs = onShakePrefChange(async () => {
      stop();
      await start();
    });

    return () => {
      cancelled = true;
      appState.remove();
      prefs();
      stop();
    };
  }, [signedIn]);
}
