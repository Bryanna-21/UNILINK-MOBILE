import { api } from './client';
import { cleanComingSoon } from '../utils/comingSoon';
import type { ComingSoonItem } from '../utils/comingSoon';

export type { ComingSoonItem };

// The public app settings (backend GET /api/config). Only the "coming soon" list is read here; the update prompt
// reads the rest (components/UpdateGate.tsx).

export async function getComingSoon(): Promise<ComingSoonItem[]> {
  const res = await api.get('/config');
  return cleanComingSoon(res.data?.data?.comingSoon);
}
