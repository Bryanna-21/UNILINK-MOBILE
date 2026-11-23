// The "coming soon" list the server sends (GET /api/config -> comingSoon). Pure, unit-tested.
export interface ComingSoonItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  eta: string | null;
}

// Cleans whatever the server sent, so a bad entry can never break the screen. Plain text only.
export function cleanComingSoon(list: unknown): ComingSoonItem[] {
  if (!Array.isArray(list)) return [];
  const out: ComingSoonItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 60) : '';
    if (!title) continue;
    out.push({
      key: typeof r.key === 'string' && r.key ? r.key.slice(0, 32) : title.slice(0, 32),
      title,
      description: typeof r.description === 'string' ? r.description.trim().slice(0, 200) : '',
      icon: typeof r.icon === 'string' ? r.icon.slice(0, 32) : '',
      eta: typeof r.eta === 'string' && r.eta.trim() ? r.eta.trim().slice(0, 30) : null,
    });
    if (out.length >= 12) break;
  }
  return out;
}
