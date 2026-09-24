import AsyncStorage from '@react-native-async-storage/async-storage';

// STATUS: REAL, BUT DELIBERATELY LIMITED SCOPE — read this before
// assuming this is equivalent to a server-side preference.
//
// This is a per-device, client-side mute: it decides whether an
// arriving push is SHOWN while the app is in the foreground (see
// pushNotifications.ts's setNotificationHandler, which now checks
// this before deciding shouldShowAlert). It does NOT tell the backend
// anything — notifyUsers() on the server has no concept of these
// preferences at all, so:
//   - A muted category's push is still SENT by the server and still
//     costs a real network round-trip to Expo's push service.
//   - A push arriving while the app is backgrounded/closed uses the
//     OS's own notification tray, which this file has no hook into —
//     muting here only suppresses the in-app foreground banner.
//   - The in-app UserNotification record (what a notifications list
//     screen would read) is unaffected either way — this never
//     deletes or hides anything from that list, only from the
//     transient foreground alert.
//
// A genuine server-side preference (stopping the send entirely) would
// mean adding a preferences field to the User model and checking it
// inside notifyUsers.middleware.js before calling sendPushNotification
// — a real, separate change to backend code that was NOT made
// tonight, on purpose, per the agreed scope (client-side only). If
// that's wanted later, notifyUsers.middleware.js's per-user loop is
// exactly where it would plug in.

export const NOTIFICATION_CATEGORIES = [
  { key: 'new_assignment', label: 'New assignments' },
  { key: 'grade_posted', label: 'Grades & results' },
  { key: 'exam_published', label: 'Exam announcements' },
  { key: 'new_message', label: 'New messages' },
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]['key'];

const PREFS_KEY = 'unilink_notification_prefs';

// Default: everything ON. A category is only ever muted by explicit
// user action — install/first-run must never start someone muted.
async function loadPrefs(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getNotificationPrefs(): Promise<Record<NotificationCategoryKey, boolean>> {
  const stored = await loadPrefs();
  const result = {} as Record<NotificationCategoryKey, boolean>;
  for (const { key } of NOTIFICATION_CATEGORIES) {
    // Absence of a stored key means "never touched by the user" —
    // treated as enabled, per the default-on rule above.
    result[key] = stored[key] !== false;
  }
  return result;
}

export async function setNotificationPref(key: NotificationCategoryKey, enabled: boolean): Promise<void> {
  const stored = await loadPrefs();
  stored[key] = enabled;
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(stored));
}

// Used by pushNotifications.ts's foreground handler — a category with
// no `type` at all (some future notification kind not in the list
// above) is never muted by default, since an unrecognized type can't
// have been explicitly turned off by the user.
export async function isCategoryMuted(type: string | undefined): Promise<boolean> {
  if (!type) return false;
  const prefs = await getNotificationPrefs();
  if (!(type in prefs)) return false;
  return prefs[type as NotificationCategoryKey] === false;
}
