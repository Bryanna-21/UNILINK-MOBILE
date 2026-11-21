// Small pure helpers for the Privacy Notice screens (the same rules as the web app's utils/legalUi.js).

export type LinkPart = { type: 'text' | 'link'; value: string };

// Splits text into plain pieces and https:// links so a link in the notice can be tapped. Only https links are made
// tappable; everything is drawn as text, so notice text can never inject anything.
export function linkify(text: unknown): LinkPart[] {
  const parts: LinkPart[] = [];
  const re = /(https:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;
  const s = String(text == null ? '' : text);
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: s.slice(last, m.index) });
    parts.push({ type: 'link', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ type: 'text', value: s.slice(last) });
  return parts;
}

export interface LegalStatus {
  currentVersion: string;
  acknowledgedVersion: string | null;
  needsAcknowledgement: boolean;
}

// The prompt shows only when the server says this person has not confirmed the current version. If the status could
// not be loaded (offline, server down) nobody is blocked: an outage must never lock people out of their account.
export const needsGate = (status: LegalStatus | null | undefined): boolean => !!status && status.needsAcknowledgement === true;

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
