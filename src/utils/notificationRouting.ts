// Decides which screen a tapped notification opens. Pure, and deliberately strict: only known
// destinations are allowed, so a crafted notification can never send the app somewhere unexpected.

const ID = /^[A-Za-z0-9_-]{6,64}$/;

export interface NotificationData {
  type?: string;
  link?: string;
  courseId?: string;
  [key: string]: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function routeForNotification(data: NotificationData | null | undefined): string {
  const d = data || {};
  const type = str(d.type);
  const link = str(d.link);
  const courseId = str(d.courseId);

  if (type === 'class_reminder' || type === 'schedule_change' || type === 'grade_posted' || type === 'new_assignment' || type === 'exam_published') {
    if (ID.test(courseId)) return `/course/${courseId}`;
  }

  // A new message arrives as link "/messages/<conversationId>"; the chat screen lives at /chat/<id>.
  const message = /^\/messages\/([^/?#]+)$/.exec(link);
  if (message && ID.test(message[1])) return `/chat/${message[1]}`;

  const timetable = /^\/school-timetable\/([^/?#]+)$/.exec(link);
  if (timetable && ID.test(timetable[1])) return `/school-timetable/${timetable[1]}`;

  if (type === 'moderation' || link === '/account-standing') return '/account-standing';

  if (type === 'opportunity' || link === '/settings/financial-support') return '/settings/financial-support';
  if (type === 'announcement' || link === '/announcements') return '/(tabs)/campus';

  return '/notifications';
}
