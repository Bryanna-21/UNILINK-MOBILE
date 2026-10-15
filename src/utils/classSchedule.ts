// Pure scheduling logic for class reminders, kept free of any phone APIs so it can be tested.

export interface Session {
  id: string;
  courseId: string;
  code: string;
  title: string;
  day: string; // "Monday" ... "Sunday"
  start: string; // "08:00"
  end: string;
  location: string;
  overridden: boolean;
}

export type LeadMinutes = 15 | 30 | 60;
export const LEAD_CHOICES: LeadMinutes[] = [15, 30, 60];

export interface ReminderPrefs {
  enabled: boolean;
  before: boolean; // a reminder ahead of class
  atStart: boolean; // another one when class begins
  leadMinutes: LeadMinutes;
  pausedUntil: string | null; // ISO date, e.g. for the holidays
}

export const DEFAULT_PREFS: ReminderPrefs = { enabled: true, before: true, atStart: true, leadMinutes: 30, pausedUntil: null };

export interface PlannedReminder {
  identifier: string;
  weekday: number; // Expo weekly triggers: 1 = Sunday ... 7 = Saturday
  hour: number;
  minute: number;
  title: string;
  body: string;
  courseId: string;
  kind: 'before' | 'start';
}

const EXPO_WEEKDAY: Record<string, number> = { Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7 };

// "07:00" or "7:00" -> minutes after midnight, else null.
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// The weekday and clock time that is `minutesBefore` before a class starts. A class at 00:10 with a
// 30 minute lead is reminded at 23:40 on the previous day.
export function triggerFor(day: string, startMinutes: number, minutesBefore: number): { weekday: number; hour: number; minute: number } | null {
  let weekday = EXPO_WEEKDAY[day];
  if (!weekday) return null;
  let t = startMinutes - minutesBefore;
  if (t < 0) {
    t += 1440;
    weekday = weekday === 1 ? 7 : weekday - 1;
  }
  return { weekday, hour: Math.floor(t / 60), minute: t % 60 };
}

// Minutes from `now` until the weekly trigger next fires (always 1 to 10080).
export function minutesUntilNext(t: { weekday: number; hour: number; minute: number }, now: Date): number {
  const nowWeekday = now.getDay() + 1; // JS: 0 = Sunday
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let diff = ((t.weekday - nowWeekday + 7) % 7) * 1440 + (t.hour * 60 + t.minute) - nowMinutes;
  if (diff <= 0) diff += 7 * 1440;
  return diff;
}

export const isPaused = (prefs: ReminderPrefs, now: Date = new Date()): boolean => !!prefs.pausedUntil && new Date(prefs.pausedUntil) > now;

// The reminders to schedule, soonest first. Phones cap pending notifications (iOS at 64), so only
// the `max` that fire soonest are kept.
export function planReminders(sessions: Session[], prefs: ReminderPrefs, now: Date = new Date(), max = 60): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const s of sessions) {
    const start = parseTime(s.start);
    if (start === null) continue;
    const body = `${s.title}${s.location ? ` · ${s.location}` : ''}`;
    if (prefs.before) {
      const t = triggerFor(s.day, start, prefs.leadMinutes);
      if (t) out.push({ identifier: `class:${s.id}:before`, ...t, title: `${s.code} starts in ${prefs.leadMinutes} minutes`, body, courseId: s.courseId, kind: 'before' });
    }
    if (prefs.atStart) {
      const t = triggerFor(s.day, start, 0);
      if (t) out.push({ identifier: `class:${s.id}:start`, ...t, title: `${s.code} is starting now`, body, courseId: s.courseId, kind: 'start' });
    }
  }
  out.sort((a, b) => minutesUntilNext(a, now) - minutesUntilNext(b, now));
  return out.slice(0, max);
}
