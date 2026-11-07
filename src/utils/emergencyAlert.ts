// Pure helpers for the emergency alert screen (no React Native imports, so they are easy to check).
//
// An alert arrives as a push whose data holds what the screen needs: who, what, where, a phone to
// call and the country's emergency numbers. Everything here is deliberately strict: only known
// fields, bounded lengths, and a phone number is only ever turned into a link when it really looks
// like one.

const ID = /^[A-Za-z0-9_-]{6,64}$/;
const KINDS = ['sos', 'medical', 'safety', 'abuse'];
const PHONE = /^\+?\d[\d ]{1,14}\d$/;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const isPhone = (value: unknown): boolean => typeof value === 'string' && PHONE.test(value.trim());
export const dialable = (value: string): string => value.replace(/[^\d+]/g, '');

export interface EmergencyNumber {
  label: string;
  number: string;
}

// The numbers arrive as a JSON string. Bad JSON, odd shapes and anything that is not a dialable
// number are dropped, never shown.
export function parseNumbers(raw: unknown): EmergencyNumber[] {
  try {
    const list = JSON.parse(str(raw) || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((n) => n && typeof n.label === 'string' && isPhone(n.number))
      .slice(0, 6)
      .map((n) => ({ label: n.label.slice(0, 60), number: n.number.trim() }));
  } catch {
    return [];
  }
}

export interface EmergencyAlertData {
  reportId?: unknown;
  kind?: unknown;
  ring?: unknown;
  student?: unknown;
  message?: unknown;
  location?: unknown;
  phone?: unknown;
  numbers?: unknown;
  [key: string]: unknown;
}

// "/emergency/alert?..." for a push's data, or null when it is not a well-formed alert.
export function emergencyAlertRoute(data: EmergencyAlertData | null | undefined): string | null {
  const d = data || {};
  const reportId = str(d.reportId);
  if (!ID.test(reportId)) return null;

  const parts = [`reportId=${encodeURIComponent(reportId)}`];
  const kind = str(d.kind);
  if (KINDS.includes(kind)) parts.push(`kind=${kind}`);
  parts.push(`ring=${str(d.ring) === '1' ? '1' : '0'}`);

  const limits: [string, number][] = [
    ['student', 80],
    ['message', 140],
    ['location', 140],
    ['phone', 20],
    ['numbers', 700],
  ];
  for (const [field, max] of limits) {
    const value = str(d[field]).slice(0, max);
    if (value) parts.push(`${field}=${encodeURIComponent(value)}`);
  }
  return `/emergency/alert?${parts.join('&')}`;
}

export function alertTitle(kind: string, student: string): string {
  const name = student || 'A student';
  if (kind === 'sos') return `SOS from ${name}`;
  if (kind === 'medical') return 'Medical emergency reported';
  if (kind === 'safety') return 'Safety emergency reported';
  if (kind === 'abuse') return 'New confidential report';
  return 'Emergency';
}
