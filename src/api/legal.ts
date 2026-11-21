import { api } from './client';
import type { LegalStatus } from '../utils/legalUi';

// The Privacy Notice endpoints (backend /api/legal). Same server text as the web app, so the two can never disagree.

export interface NoticeBlock {
  p?: string;
  ul?: string[];
}
export interface NoticeSection {
  id: string;
  number: number | string;
  title: string;
  blocks: NoticeBlock[];
}
export interface PrivacyNotice {
  version: string;
  effectiveDate: string;
  intro?: string;
  sections: NoticeSection[];
  isDraft?: boolean;
  missing?: string[];
}

export async function getPrivacyNotice(): Promise<PrivacyNotice> {
  const res = await api.get('/legal/privacy');
  return res.data?.data ?? res.data;
}

export async function getLegalStatus(): Promise<LegalStatus> {
  const res = await api.get('/legal/status');
  return res.data?.data ?? res.data;
}

export async function acknowledgePrivacy(version: string): Promise<void> {
  await api.post('/legal/acknowledge', { policyType: 'privacy', version, source: 'mobile' });
}
