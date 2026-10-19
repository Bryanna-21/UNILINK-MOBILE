import { useEffect } from 'react';
import { router } from 'expo-router';
import { setAccountBlockedHandler } from '../api/client';

// When the server says the account is suspended or closed (403 ACCOUNT_SUSPENDED or
// ACCOUNT_TERMINATED), every normal screen would just show errors. Instead, take the person to
// Account standing, where they can read why and appeal. The standing screen sets `standingOpen`
// so many failing requests at once cannot stack up navigations.
let standingOpen = false;
let lastRedirect = 0;

export function markStandingOpen(open: boolean) {
  standingOpen = open;
}

export function useAccountBlockRouting() {
  useEffect(() => {
    setAccountBlockedHandler(() => {
      const now = Date.now();
      if (standingOpen || now - lastRedirect < 2000) return;
      lastRedirect = now;
      try {
        router.replace('/account-standing' as any);
      } catch {
        // Navigation may not be ready yet; the next failing request will try again.
      }
    });
    return () => setAccountBlockedHandler(null);
  }, []);
}
