import { api } from './client';

// "Report a problem" (backend POST /api/feedback). The server decides who sent it and which university it is for.
export type FeedbackCategory = 'bug' | 'idea' | 'other';

export interface FeedbackContext {
  platform: string;
  appVersion: string;
  screen: string;
  userAgent: string;
}

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 2000;

export async function sendFeedback(input: { category: FeedbackCategory; message: string; context: FeedbackContext }): Promise<{ reference: string }> {
  const res = await api.post('/feedback', input);
  return { reference: String(res.data?.data?.reference ?? '') };
}
