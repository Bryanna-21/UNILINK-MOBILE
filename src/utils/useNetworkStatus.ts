import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// STATUS: REAL. Fills the actual gap in offlineCache.ts's original
// scope note: that file could only ever REACT to a failed request and
// guess it was probably a connectivity issue. This hook gives screens
// a genuine, proactive signal — "the device currently has no usable
// internet connection" — so the UI can say "You're offline, showing
// saved data" with actual confidence, rather than showing the same
// message for a genuine outage, a 500 from the server, and a 401.
// Those are different problems with different fixes, and a screen
// that treats them all identically is misleading, not thorough.
//
// isConnected true/false comes from NetInfo's own connectivity check
// (radio/interface state). isInternetReachable is stricter — it
// reflects NetInfo's actual reachability probe, which is NOT always
// available on every platform/config and starts out `null` until
// that probe resolves. We treat "offline" as either being explicitly
// false — never invent an offline state just because
// isInternetReachable hasn't finished probing yet, since that would
// misreport a perfectly fine connection as offline during the brief
// window right after mount.
export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const definitelyOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(definitelyOffline);
    });
    return () => unsubscribe();
  }, []);

  return { isOffline };
}
