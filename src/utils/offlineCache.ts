import AsyncStorage from '@react-native-async-storage/async-storage';

// STATUS: REAL, GENUINELY NARROW SCOPE. This is not the full
// "Downloads / offline mode" feature the old Settings shell
// described — that would mean deciding what to cache app-wide, when
// to invalidate it, and building a real storage-usage UI, which is
// legitimately a bigger architecture decision than a couple of files
// built under time pressure should attempt. What this IS: a real,
// reusable primitive — cache the last successful response for a
// given key, serve it when a live fetch fails — paired with
// useNetworkStatus.ts for genuine proactive connectivity detection
// (NetInfo), not just error-guessing. Wired into two real,
// high-traffic read screens so far (home.tsx's dashboard and
// courses.tsx) to prove the pattern generalizes, not into every
// screen in the app.
//
// Still explicitly OUT of scope, same as before: no offline
// mutations (creating/editing anything while offline), no sync/
// conflict-resolution queue, no user-facing storage-usage or
// "manage downloads" UI. Those are each their own real feature, not
// a follow-on to this file.
//
// Deliberately NOT a fake "Download" button like web's
// Student/Notes.js and Student/Results.js, which just console.log
// and do nothing — this genuinely persists real data and genuinely
// serves it back when offline.

const CACHE_PREFIX = 'unilink_offline_cache_';

export async function cacheResponse<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // Best-effort — a failed cache write should never break the
    // successful live request that triggered it.
  }
}

export interface CachedResult<T> {
  data: T;
  cachedAt: number;
}

export async function getCachedResponse<T>(key: string): Promise<CachedResult<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedResult<T>;
  } catch {
    return null;
  }
}

export function formatCacheAge(cachedAt: number): string {
  const minutes = Math.round((Date.now() - cachedAt) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
