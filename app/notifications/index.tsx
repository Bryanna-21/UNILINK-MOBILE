import { useCallback, useEffect, useMemo, useState } from 'react';
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

type NotificationType = 'grade_posted' | 'new_assignment' | 'new_message' | 'exam_published';

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
  return null;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.data ?? []);
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

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
        setUnreadCount((prev) => Math.max(0, prev - 1));
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
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
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

      {isLoading ? (
        <LoadingSkeletonList rows={5} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No notifications yet.</Text>
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
