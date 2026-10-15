import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { cancelClassReminders, syncClassReminders } from './classReminders';

// Keeps class reminders in step with the signed-in account: syncs when the app opens, when the
// account changes, and when the app returns to the foreground (at most every 10 minutes). Signing
// out removes the reminders so a different account on the same phone does not receive them.
// The biometric lock counts as still signed in, so locking the app never cancels reminders.
const MIN_GAP_MS = 10 * 60 * 1000;

export function useClassReminderSync() {
  const userId = useAuthStore((s) => ((s.user as any)?.id ?? (s.user as any)?._id ?? null) as string | null);
  const present = useAuthStore((s) => !!s.user || !!s.pendingBiometricUnlock);
  const lastRun = useRef(0);
  const hadUser = useRef(false);

  useEffect(() => {
    if (!present) {
      if (hadUser.current) cancelClassReminders().catch(() => {});
      hadUser.current = false;
      return;
    }
    hadUser.current = true;
  }, [present]);

  useEffect(() => {
    if (!userId) return;
    const run = () => {
      lastRun.current = Date.now();
      syncClassReminders().catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRun.current > MIN_GAP_MS) run();
    });
    return () => sub.remove();
  }, [userId]);
}
