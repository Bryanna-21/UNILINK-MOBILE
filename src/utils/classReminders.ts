import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { DEFAULT_PREFS, LEAD_CHOICES, isPaused, planReminders, type LeadMinutes, type ReminderPrefs, type Session } from './classSchedule';

// STATUS: REAL. Class reminders are scheduled ON THE PHONE (weekly repeating local notifications),
// so they fire on time even with no internet and without the server being awake. The schedule is
// refreshed from GET /schedule/mine each time the app opens, so changes to a class reach the phone
// then. Reminders for classes moved after the app was last opened arrive on the next open.

const PREFS_KEY = 'unilink_class_reminder_prefs';
const STATUS_KEY = 'unilink_class_reminder_status';
const CHANNEL_ID = 'class-reminders';

export type SyncStatus = 'scheduled' | 'off' | 'paused' | 'no-permission' | 'unsupported' | 'offline';
export interface SyncResult {
  status: SyncStatus;
  reminders: number;
  classes: number;
}

async function notificationsModule(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      enabled: p.enabled !== false,
      before: p.before !== false,
      atStart: p.atStart !== false,
      leadMinutes: LEAD_CHOICES.includes(p.leadMinutes) ? (p.leadMinutes as LeadMinutes) : DEFAULT_PREFS.leadMinutes,
      pausedUntil: typeof p.pausedUntil === 'string' ? p.pausedUntil : null,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveReminderPrefs(patch: Partial<ReminderPrefs>): Promise<ReminderPrefs> {
  const next = { ...(await getReminderPrefs()), ...patch };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function getLastSync(): Promise<(SyncResult & { at: number }) | null> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function remember(result: SyncResult): Promise<SyncResult> {
  await AsyncStorage.setItem(STATUS_KEY, JSON.stringify({ ...result, at: Date.now() })).catch(() => {});
  return result;
}

// Removes only reminders this feature created, never other notifications.
export async function cancelClassReminders(): Promise<void> {
  const N = await notificationsModule();
  if (!N) return;
  const all = await N.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.content.data?.type === 'class_reminder').map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
}

export async function syncClassReminders(): Promise<SyncResult> {
  const prefs = await getReminderPrefs();
  const N = await notificationsModule();
  if (!N) return remember({ status: 'unsupported', reminders: 0, classes: 0 });

  if (!prefs.enabled) {
    await cancelClassReminders();
    return remember({ status: 'off', reminders: 0, classes: 0 });
  }
  if (isPaused(prefs)) {
    await cancelClassReminders();
    return remember({ status: 'paused', reminders: 0, classes: 0 });
  }

  const perm = await N.getPermissionsAsync();
  if (perm.status !== 'granted') return remember({ status: 'no-permission', reminders: 0, classes: 0 });

  // Fetch FIRST. If the phone is offline, the reminders already scheduled stay exactly as they are.
  let sessions: Session[];
  try {
    const res = await api.get('/schedule/mine');
    sessions = res.data?.data ?? [];
  } catch {
    const last = await getLastSync();
    return { status: 'offline', reminders: last?.reminders ?? 0, classes: last?.classes ?? 0 };
  }

  const plan = planReminders(sessions, prefs);
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL_ID, { name: 'Class reminders', importance: N.AndroidImportance.HIGH });
  }
  await cancelClassReminders();

  let scheduled = 0;
  for (const r of plan) {
    try {
      await N.scheduleNotificationAsync({
        identifier: r.identifier,
        content: { title: r.title, body: r.body, data: { type: 'class_reminder', courseId: r.courseId, kind: r.kind } },
        trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: r.weekday, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID },
      });
      scheduled++;
    } catch (err) {
      console.log('[class-reminders] could not schedule', r.identifier, err);
    }
  }
  return remember({ status: 'scheduled', reminders: scheduled, classes: sessions.length });
}
