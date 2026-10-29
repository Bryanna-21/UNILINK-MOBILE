import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

// STATUS: LIVE — GET /notifications, PATCH /notifications/:id/read,
// PATCH /notifications/read-all all match web's userNotificationService.js
// exactly (confirmed by reading it directly). This is the
// student/lecturer-facing system — deliberately NOT the admin-only
// /api/admin/notifications surface, which is a separate, role-gated
// system on web (RoleGuard roles={["admin"]}) that a student/lecturer
// mobile app has no business calling. Confirmed by reading
// AppRoutes.js's actual RoleGuard props, not by route name alone —
// both web routes are named similarly enough ("/notifications" vs
// "/notifications-me") that guessing from the URL would have picked
// the wrong one.
//
// Not ported from web: Topbar.js's notification bell badge, which
// shows a hardcoded "3" regardless of actual unread count. This
// screen's badge uses the real unreadCount from the API response.

// The tabs, like Instagram's: everything, then people following you, likes and comments on your
// posts, mentions, and academic updates. New messages are not here: they show on Messages.
type Category = 'all' | 'followers' | 'activity' | 'mentions' | 'updates';
const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'followers', label: 'Followers' },
  { key: 'activity', label: 'Likes & comments' },
  { key: 'mentions', label: 'Mentions & tags' },
  { key: 'updates', label: 'Updates' },
];
type Counts = Record<Category, number>;
const NO_COUNTS: Counts = { all: 0, followers: 0, activity: 0, mentions: 0, updates: 0 };

type NotificationType =
  | 'grade_posted'
  | 'new_assignment'
  | 'new_message'
  | 'exam_published'
  | 'new_follower'
  | 'post_like'
  | 'post_comment'
  | 'mention';

interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  grade_posted: 'Grade',
  new_assignment: 'Assignment',
  new_message: 'Message',
  exam_published: 'Exam',
  new_follower: 'Follower',
  post_like: 'Like',
  post_comment: 'Comment',
  mention: 'Mention',
  announcement: 'Announcement',
  timetable: 'Timetable',
  opportunity: 'Opportunity',
  schedule_change: 'Schedule',
  moderation: 'Account',
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

// Maps a notification's web-side `link` (a React Router path like
// "/exams/abc123" or "/messages/abc123") to the equivalent mobile
// route. Not every web link has a mobile screen yet (e.g. admin
// links would never appear here since this endpoint is
// student/lecturer-only, but a few web-only paths could still show up
// if the backend ever adds one) — unmapped links are handled by
// simply not navigating, rather than crashing on a route that doesn't
// exist in this app.
function resolveMobileRoute(link?: string): string | null {
  if (!link) return null;
  if (link.startsWith('/exams/')) return `/exams/${link.split('/')[2]}`;
  if (link.startsWith('/messages/')) return `/chat/${link.split('/')[2]}`;
  if (link.startsWith('/assignment/')) return link; // same shape both platforms
  // Followers go to that person's profile; likes, comments and mentions to the post.
  if (link.startsWith('/user/')) return `/user/${link.split('/')[2]}`;
  if (link.startsWith('/post/')) return `/post/${link.split('/')[2]}`;
  return null;
}

// Which tab a notification belongs to (the same grouping the server uses).
function n_category(type: string): Category | null {
  if (type === 'new_message') return null;
  if (type === 'new_follower') return 'followers';
  if (type === 'post_like' || type === 'post_comment') return 'activity';
  if (type === 'mention') return 'mentions';
  return 'updates';
}

export default function NotificationsScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [category, setCategory] = useState<Category>('all');
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const unreadCount = counts[category];
  const latestRequest = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: Spacing.md,
          paddingTop: Spacing.xl,
        },
        title: { fontSize: 24, fontWeight: '800', color: colors.text },
        markAllLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
        tabRow: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xs },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
        tabTextActive: { color: colors.white },
        tabBadge: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 5,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBadgeActive: { backgroundColor: colors.white },
        tabBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
        tabBadgeTextActive: { color: colors.primary },
        card: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardUnread: { borderColor: colors.primary },
        cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        typeTag: {
          fontSize: 10,
          fontWeight: '700',
          color: colors.primary,
          textTransform: 'uppercase',
        },
        unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
        notifTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
        notifMessage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        notifDate: { fontSize: 11, color: colors.textMuted, marginTop: Spacing.xs },
        spinner: { marginTop: Spacing.xl },
        emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
      }),
    [colors]
  );

  const loadNotifications = useCallback(async (isRefresh = false) => {
    // A slow answer for a tab you have already left must not overwrite the tab you are on.
    const requestId = ++latestRequest.current;
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications', { params: { category } });
      if (requestId !== latestRequest.current) return;
      setNotifications(res.data?.data ?? []);
      setCounts({ ...NO_COUNTS, ...(res.data?.counts ?? {}) });
    } catch (err: any) {
      if (requestId !== latestRequest.current) return;
      setError(err?.response?.data?.message || 'Unable to load notifications.');
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [category]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handlePress = async (notification: AppNotification) => {
    if (!notification.read) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
        );
        // One fewer unread in this notification's own tab, and in All.
        setCounts((prev) => {
          const own: Category =
            n_category(notification.type) ?? 'updates';
          return {
            ...prev,
            all: Math.max(0, prev.all - 1),
            [own]: Math.max(0, prev[own] - 1),
          };
        });
      } catch {
        // Non-fatal, matches web's own behavior exactly: still navigate
        // even if marking read failed — the notification content is
        // more important to the user than the read-state sync.
      }
    }

    const route = resolveMobileRoute(notification.link);
    if (route) router.push(route as any);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', null, { params: { category } });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      loadNotifications(true); // the other tabs' counts changed too
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not mark all as read.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadNotifications(true)} />}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Notifications
        </Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
          >
            <Text style={styles.markAllLink}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <StatusBanner status="real" note="Notifications are fetched live from your account." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === category;
          const count = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setCategory(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label}${count > 0 ? `, ${count} unread` : ''}`}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {count > 0 ? (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <LoadingSkeletonList rows={5} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            {category === 'all' ? 'No notifications yet.' : `No ${TABS.find((t) => t.key === category)?.label.toLowerCase()} yet.`}
          </Text>
        </View>
      ) : (
        notifications.map((n) => (
          <TouchableOpacity
            key={n._id}
            style={[styles.card, !n.read && styles.cardUnread]}
            onPress={() => handlePress(n)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? '' : 'Unread. '}${TYPE_LABEL[n.type] ?? n.type}: ${n.title}${n.message ? '. ' + n.message : ''}. ${formatDate(n.createdAt)}`}
          >
            <View style={styles.cardTop}>
              <Text style={styles.typeTag}>{TYPE_LABEL[n.type] ?? n.type}</Text>
              {!n.read ? (
                <View style={styles.unreadDot} accessibilityElementsHidden importantForAccessibility="no" />
              ) : null}
            </View>
            <Text style={styles.notifTitle}>{n.title}</Text>
            {n.message ? <Text style={styles.notifMessage}>{n.message}</Text> : null}
            <Text style={styles.notifDate}>{formatDate(n.createdAt)}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}
