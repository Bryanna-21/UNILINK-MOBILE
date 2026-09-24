import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { cacheResponse, getCachedResponse, formatCacheAge } from '../../src/utils/offlineCache';
import { useNetworkStatus } from '../../src/utils/useNetworkStatus';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const todayDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface CourseNote {
  _id: string;
  title: string;
  courseTitle: string;
}

interface UpcomingCat {
  _id: string;
  title: string;
  courseTitle: string;
  date?: string;
}

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

export default function HomeScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [notes, setNotes] = useState<CourseNote[]>([]);
  const [cats, setCats] = useState<UpcomingCat[]>([]);
  const [classesToday, setClassesToday] = useState<ClassToday[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
          padding: Spacing.md,
          paddingTop: Spacing.xl,
        },
        greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
        role: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 },
        logout: { color: colors.danger, fontWeight: '600', fontSize: 13 },
        bellButton: { position: 'relative', padding: 4 },
        bellIcon: { fontSize: 20 },
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
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: Spacing.md,
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
        emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
        spinner: { marginTop: Spacing.sm },
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
        signedTag: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
        quickActions: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm },
        quickAction: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
        quickActionText: { color: colors.white, fontWeight: '700' },
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
        setNotes([]);
        setCats([]);
        setClassesToday([]);
        setAttendance([]);
        return;
      }

      const today = todayDateString();
      const todayName = DAY_NAMES[new Date().getDay()];

      const perCourseResults = await Promise.all(
        myCourses.map(async (course: any) => {
          const [notesRes, catsRes, scheduleRes, myAttendanceRes] = await Promise.all([
            api.get(`/courses/${course._id}/notes`).catch(() => ({ data: { data: [] } })),
            api.get(`/courses/${course._id}/cats`).catch(() => ({ data: { data: [] } })),
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
            notes: (notesRes.data?.data ?? []).map((n: any) => ({
              _id: n._id,
              title: n.title,
              courseTitle: course.title,
            })),
            cats: (catsRes.data?.data ?? []).map((c: any) => ({
              _id: c._id,
              title: c.title,
              courseTitle: course.title,
              date: c.date,
            })),
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

      const finalNotes = perCourseResults.flatMap((r) => r.notes);
      const finalCats = perCourseResults.flatMap((r) => r.cats);
      const finalClassesToday = perCourseResults
        .flatMap((r) => r.classesToday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const finalAttendance = perCourseResults.map((r) => r.attendance);

      setNotes(finalNotes);
      setCats(finalCats);
      setClassesToday(finalClassesToday);
      setAttendance(finalAttendance);
      setIsShowingOfflineData(false);
      setOfflineCacheAge(null);

      // Cache the successful result so a future failed request (e.g.
      // genuinely offline, not just a slow server) has real data to
      // fall back to instead of an empty error screen.
      cacheResponse(`home_dashboard_${user.id}`, {
        notes: finalNotes,
        cats: finalCats,
        classesToday: finalClassesToday,
        attendance: finalAttendance,
      });
    } catch (err: any) {
      // Real offline fallback, not a fake download button: if a cached
      // dashboard exists for this user, show it with an honest "showing
      // offline data from X ago" note rather than just an error banner.
      const cached = await getCachedResponse<{
        notes: CourseNote[];
        cats: UpcomingCat[];
        classesToday: ClassToday[];
        attendance: AttendanceStatus[];
      }>(`home_dashboard_${user.id}`);

      if (cached) {
        setNotes(cached.data.notes);
        setCats(cached.data.cats);
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

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
          <Text style={styles.role}>{user?.role} {user?.universityId ? `· ${user.universityId}` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
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
            <Text style={styles.bellIcon} accessibilityElementsHidden importantForAccessibility="no">
              🔔
            </Text>
            {unreadNotifCount > 0 ? (
              <View style={styles.bellBadge} accessibilityElementsHidden importantForAccessibility="no">
                <Text style={styles.bellBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <StatusBanner status="real" note="Greeting and role come from your real account." />

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
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Today's Classes
        </Text>
        <StatusBanner status="real" note="Pulled live from your enrolled courses' timetables." />
        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : classesToday.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/(tabs)/courses')}
            accessibilityRole="button"
            accessibilityLabel="No classes today. View Courses."
          >
            <Text style={styles.emptyText}>No classes today. Tap to view Courses.</Text>
          </TouchableOpacity>
        ) : (
          classesToday.map((cls) => (
            <View key={cls._id} style={styles.emptyCard}>
              <Text style={styles.noteTitle}>
                {cls.startTime} – {cls.endTime} · {cls.courseTitle}
              </Text>
              <Text style={styles.noteCourse}>
                {cls.location || 'Location not set'}{cls.isOverridden ? ' · your schedule' : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Continue Learning
        </Text>
        <StatusBanner status="real" note="Notes are pulled live from your enrolled courses." />
        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : notes.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/(tabs)/courses')}
            accessibilityRole="button"
            accessibilityLabel="No recent notes yet. View Courses."
          >
            <Text style={styles.emptyText}>No recent notes yet. Tap to view Courses.</Text>
          </TouchableOpacity>
        ) : (
          notes.slice(0, 5).map((note) => (
            <View key={note._id} style={styles.emptyCard}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteCourse}>{note.courseTitle}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Upcoming CAT
        </Text>
        <StatusBanner status="real" note="CATs are pulled live from your enrolled courses." />
        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : cats.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/(tabs)/courses')}
            accessibilityRole="button"
            accessibilityLabel="No CATs scheduled. View Courses."
          >
            <Text style={styles.emptyText}>No CATs scheduled. Tap to view Courses.</Text>
          </TouchableOpacity>
        ) : (
          cats.slice(0, 5).map((cat) => (
            <TouchableOpacity
              key={cat._id}
              style={styles.emptyCard}
              onPress={() => router.push(`/cat/${cat._id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`${cat.title}, ${cat.courseTitle}${cat.date ? `, ${cat.date}` : ''}`}
            >
              <Text style={styles.noteTitle}>{cat.title}</Text>
              <Text style={styles.noteCourse}>
                {cat.courseTitle}{cat.date ? ` · ${cat.date}` : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Attendance
        </Text>
        <StatusBanner status="real" note="Sign in per course for today. One signature per day, enforced by the backend." />
        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Quick Actions
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.danger }]}
            onPress={() => router.push('/(tabs)/emergency' as any)}
            accessibilityRole="button"
            accessibilityLabel="Emergency"
          >
            <Text style={styles.quickActionText}>🆘 Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/ai' as any)}
            accessibilityRole="button"
            accessibilityLabel="Ask AI"
          >
            <Text style={styles.quickActionText}>✨ Ask AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/lost-and-found' as any)}
            accessibilityRole="button"
            accessibilityLabel="Lost and Found"
          >
            <Text style={styles.quickActionText}>🔎 Lost & Found</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
