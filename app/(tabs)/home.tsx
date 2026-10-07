import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { cacheResponse, getCachedResponse, formatCacheAge } from '../../src/utils/offlineCache';
import { useNetworkStatus } from '../../src/utils/useNetworkStatus';
import LoadingSkeleton from '../../src/components/LoadingSkeleton';
import Svg, { Path } from 'react-native-svg';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const todayDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface ClassToday {
  _id: string;
  courseId: string;
  courseTitle: string;
  startTime: string;
  endTime: string;
  location?: string;
  isOverridden: boolean;
}

interface AttendanceStatus {
  courseId: string;
  courseTitle: string;
  signedToday: boolean;
}

interface Announcement {
  _id: string;
  title: string;
  body: string;
  courseId?: string | null;
  campusId?: string | null;
  universityId?: string;
  postedBy?: string;
  createdAt: string;
}

export default function HomeScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  const [classesToday, setClassesToday] = useState<ClassToday[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingCourseId, setSigningCourseId] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isShowingOfflineData, setIsShowingOfflineData] = useState(false);
  const [offlineCacheAge, setOfflineCacheAge] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: Spacing.md,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderRadius: Radius.lg,
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.primary + '22',
        },
        greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
        role: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 },
        bellButton: { position: 'relative', padding: 4 },
        bellIcon: {
          width: 22,
          height: 22,
        },
        bellBadge: {
          position: 'absolute',
          top: -2,
          right: -2,
          backgroundColor: colors.danger,
          borderRadius: 8,
          minWidth: 16,
          height: 16,
          paddingHorizontal: 3,
          alignItems: 'center',
          justifyContent: 'center',
        },
        bellBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
        offlineBanner: {
          backgroundColor: colors.background === '#0A0A0A' ? '#3A2E14' : '#FEF9E7',
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.sm,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: '#F59E0B',
        },
        offlineBannerText: { fontSize: 12, color: colors.text },
        section: { marginTop: Spacing.lg },
        sectionTitle: {
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
        },
        sectionSubtitle: {
          fontSize: 12,
          color: colors.textMuted,
          paddingHorizontal: Spacing.md,
          marginTop: -2,
          marginBottom: Spacing.xs,
        },
        emptyCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.lg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        timetableCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
        },
        timetableTime: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '800',
        },
        timetableCourse: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
          marginTop: 3,
        },
        timetableLocation: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 4,
        },
        timetableLink: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '800',
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.sm,
        },
        emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
        noteTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
        noteCourse: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        signButton: {
          backgroundColor: colors.primary,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.sm,
        },
        signButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
        signedTag: {
          color: colors.secondary,
          backgroundColor: colors.secondarySoft,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 5,
          borderRadius: Radius.full,
          fontSize: 12,
          fontWeight: '800',
        },
        announcementCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
        },
        announcementTitle: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        announcementBody: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 18,
          marginTop: 5,
        },
        announcementMeta: {
          color: colors.textMuted,
          fontSize: 11,
          marginTop: 7,
        },
        viewAllText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.sm,
        },
      }),
    [colors]
  );

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const coursesRes = await api.get('/courses');
      const allCourses = coursesRes.data?.data ?? [];
      const myCourses = allCourses.filter((c: any) =>
        Array.isArray(c.enrolledStudentIds) && c.enrolledStudentIds.includes(user.id)
      );

      if (myCourses.length === 0) {
        setClassesToday([]);
        setAttendance([]);
        return;
      }

      const today = todayDateString();
      const todayName = DAY_NAMES[new Date().getDay()];

      const perCourseResults = await Promise.all(
        myCourses.map(async (course: any) => {
          const [scheduleRes, myAttendanceRes] = await Promise.all([
            api.get(`/courses/${course._id}/timetable/mine`).catch(() => ({ data: { data: [] } })),
            api.get(`/courses/${course._id}/attendance/mine`).catch(() => ({ data: { data: [] } })),
          ]);

          const todaysEntries = (scheduleRes.data?.data ?? []).filter(
            (entry: any) => entry.dayOfWeek === todayName
          );
          const alreadySignedToday = (myAttendanceRes.data?.data ?? []).some(
            (a: any) => a.date === today
          );

          return {
            courseTitle: course.title,
            classesToday: todaysEntries.map((entry: any) => ({
              _id: entry._id,
              courseId: course._id,
              courseTitle: course.title,
              startTime: entry.startTime,
              endTime: entry.endTime,
              location: entry.location,
              isOverridden: !!entry.isOverridden,
            })),
            attendance: {
              courseId: course._id,
              courseTitle: course.title,
              signedToday: alreadySignedToday,
            },
          };
        })
      );

      const finalClassesToday = perCourseResults
        .flatMap((r) => r.classesToday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const finalAttendance = perCourseResults.map((r) => r.attendance);

      setClassesToday(finalClassesToday);
      setAttendance(finalAttendance);
      setIsShowingOfflineData(false);
      setOfflineCacheAge(null);

      // Cache the successful result so a future failed request (e.g.
      // genuinely offline, not just a slow server) has real data to
      // fall back to instead of an empty error screen.
      cacheResponse(`home_dashboard_${user.id}`, {
        classesToday: finalClassesToday,
        attendance: finalAttendance,
      });
    } catch (err: any) {
      // Real offline fallback, not a fake download button: if a cached
      // dashboard exists for this user, show it with an honest "showing
      // offline data from X ago" note rather than just an error banner.
      const cached = await getCachedResponse<{
        classesToday: ClassToday[];
        attendance: AttendanceStatus[];
      }>(`home_dashboard_${user.id}`);

      if (cached) {
        setClassesToday(cached.data.classesToday);
        setAttendance(cached.data.attendance);
        setIsShowingOfflineData(true);
        setOfflineCacheAge(formatCacheAge(cached.cachedAt));
      } else {
        setLoadError('Could not load your dashboard. Pull down to try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Announcements are loaded independently from the academic
  // dashboard so students can see campus information even
  // without course enrollment.
  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const loadAnnouncements = async () => {
      setIsLoadingAnnouncements(true);

      try {
        const res = await api.get('/community/announcements');
        const data: Announcement[] = res.data?.data ?? [];

        if (!active) return;

        setAnnouncements(data);
        await cacheResponse(`home_announcements_${user.id}`, data);
      } catch {
        const cached = await getCachedResponse<Announcement[]>(
          `home_announcements_${user.id}`
        );

        if (active && cached) {
          setAnnouncements(cached.data);
        }
      } finally {
        if (active) {
          setIsLoadingAnnouncements(false);
        }
      }
    };

    loadAnnouncements();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Deliberately separate from loadDashboard above: this is a
  // nice-to-have badge count, not core dashboard data. Folding it into
  // loadDashboard's try/catch would mean a slow or failing
  // notifications endpoint could delay rendering the whole home screen
  // or incorrectly surface the dashboard's own error banner. Fails
  // silently — worst case the badge just doesn't show a number, which
  // is a fine degrade for something this secondary.
  useEffect(() => {
    api
      .get('/notifications')
      .then((res) => setUnreadNotifCount(res.data?.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  const handleSignAttendance = async (courseId: string, courseTitle: string) => {
    setSigningCourseId(courseId);
    try {
      await api.post(`/courses/${courseId}/attendance`, { date: todayDateString() });
      Alert.alert('Signed', `Attendance recorded for ${courseTitle} today.`);
      setAttendance((prev) =>
        prev.map((a) => (a.courseId === courseId ? { ...a, signedToday: true } : a))
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        Alert.alert('Already signed', `You've already signed attendance for ${courseTitle} today.`);
        setAttendance((prev) =>
          prev.map((a) => (a.courseId === courseId ? { ...a, signedToday: true } : a))
        );
      } else {
        Alert.alert('Could not sign attendance', err?.response?.data?.message || 'Please try again.');
      }
    } finally {
      setSigningCourseId(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting} numberOfLines={1}>
          Hi, {user?.name?.split(' ')[0] || 'there'} 👋
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          style={styles.bellButton}
          accessibilityRole="button"
          accessibilityLabel={
            unreadNotifCount > 0
              ? `Notifications, ${unreadNotifCount} unread`
              : 'Notifications'
          }
        >
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
              stroke={colors.text}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {unreadNotifCount > 0 ? (
            <View style={styles.bellBadge} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={styles.bellBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>


      {isShowingOfflineData ? (
        <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
          <Text style={styles.offlineBannerText}>
            {isOffline
              ? `📡 You're offline — showing saved data from ${offlineCacheAge}.`
              : `📡 Couldn't reach the server — showing saved data from ${offlineCacheAge}. Pull down to try again.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Campus Announcements
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/announcements' as any)}
            accessibilityRole="button"
            accessibilityLabel="View all campus announcements"
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {isLoadingAnnouncements ? (
          <>
            <View style={styles.emptyCard}>
              <LoadingSkeleton width="62%" height={16} />
              <LoadingSkeleton width="92%" height={12} style={{ marginTop: 10 }} />
              <LoadingSkeleton width="76%" height={12} style={{ marginTop: 7 }} />
            </View>
            <View style={styles.emptyCard}>
              <LoadingSkeleton width="48%" height={16} />
              <LoadingSkeleton width="88%" height={12} style={{ marginTop: 10 }} />
              <LoadingSkeleton width="68%" height={12} style={{ marginTop: 7 }} />
            </View>
          </>
        ) : announcements.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No campus announcements right now.
            </Text>
          </View>
        ) : (
          announcements.slice(0, 3).map((announcement) => (
            <TouchableOpacity
              key={announcement._id}
              style={styles.announcementCard}
              onPress={() => router.push('/announcements' as any)}
              accessibilityRole="button"
              accessibilityLabel={`Announcement: ${announcement.title}`}
            >
              <Text style={styles.announcementTitle}>
                {announcement.title}
              </Text>

              <Text
                style={styles.announcementBody}
                numberOfLines={3}
              >
                {announcement.body}
              </Text>

              <Text style={styles.announcementMeta}>
                {announcement.courseId
                  ? 'Course announcement'
                  : announcement.campusId
                    ? 'Campus announcement'
                    : 'University announcement'}
                {announcement.createdAt
                  ? ` · ${new Date(announcement.createdAt).toLocaleDateString()}`
                  : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Today's Timetable
        </Text>
        {isLoading ? (
          <>
            <View style={styles.timetableCard}>
              <LoadingSkeleton width="32%" height={13} />
              <LoadingSkeleton width="72%" height={15} style={{ marginTop: 8 }} />
              <LoadingSkeleton width="45%" height={11} style={{ marginTop: 7 }} />
            </View>
            <View style={styles.timetableCard}>
              <LoadingSkeleton width="28%" height={13} />
              <LoadingSkeleton width="66%" height={15} style={{ marginTop: 8 }} />
              <LoadingSkeleton width="40%" height={11} style={{ marginTop: 7 }} />
            </View>
          </>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : classesToday.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/(tabs)/academics' as any)}
            accessibilityRole="button"
            accessibilityLabel="No classes today. View Academics."
          >
            <Text style={styles.emptyText}>No classes today. Tap to view Academics.</Text>
          </TouchableOpacity>
        ) : (
          classesToday.map((cls) => (
            <View key={cls._id} style={styles.timetableCard}>
              <Text style={styles.timetableTime}>
                {cls.startTime} – {cls.endTime}
              </Text>
              <Text style={styles.timetableCourse}>
                {cls.courseTitle}
              </Text>
              <Text style={styles.timetableLocation}>
                {cls.location || 'Location not set'}
                {cls.isOverridden ? ' · your schedule' : ''}
              </Text>
            </View>
          ))
        )}
        <TouchableOpacity
          onPress={() => router.push('/courses' as any)}
          accessibilityRole="button"
          accessibilityLabel="View full timetable"
        >
          <Text style={styles.timetableLink}>View full timetable →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Attendance
        </Text>
        {isLoading ? (
          <>
            <View style={styles.emptyCard}>
              <LoadingSkeleton width="55%" height={15} />
              <LoadingSkeleton width="82%" height={12} style={{ marginTop: 10 }} />
            </View>
            <View style={styles.emptyCard}>
              <LoadingSkeleton width="48%" height={15} />
              <LoadingSkeleton width="76%" height={12} style={{ marginTop: 10 }} />
            </View>
          </>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : attendance.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Enroll in a course to sign attendance.</Text>
          </View>
        ) : (
          attendance.map((a) => (
            <View key={a.courseId} style={styles.emptyCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.noteTitle}>{a.courseTitle}</Text>
                {a.signedToday ? (
                  <Text style={styles.signedTag}>Signed ✓</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.signButton}
                    disabled={signingCourseId === a.courseId}
                    onPress={() => handleSignAttendance(a.courseId, a.courseTitle)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign attendance for ${a.courseTitle}`}
                    accessibilityState={{
                      disabled: signingCourseId === a.courseId,
                      busy: signingCourseId === a.courseId,
                    }}
                  >
                    <Text style={styles.signButtonText}>
                      {signingCourseId === a.courseId ? 'Signing…' : 'Sign in'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
}
