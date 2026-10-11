import AsyncStorage from '@react-native-async-storage/async-storage';

// Keeps non-secret form answers for a day so a restart (an update, the phone killing the app while
// the person checks their email) does not wipe a half-finished registration or course selection.
// NEVER pass passwords or codes here.
const PREFIX = 'unilink_draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function saveDraft(key: string, data: object): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // A draft that fails to save is not worth interrupting the person for.
  }
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
