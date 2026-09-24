import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { cacheResponse, getCachedResponse, formatCacheAge } from '../../src/utils/offlineCache';
import { useNetworkStatus } from '../../src/utils/useNetworkStatus';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: LIVE — courses are fetched from GET /api/courses on the real
// backend (see src/api/client.ts for the base URL and auth wiring).
// The Course model, route, and controller already exist on
// UNILINK-BACKEND; this screen previously showed hardcoded placeholder
// data instead of calling it.
//
// NEW tonight: offline read-cache, same primitive and same pattern as
// home.tsx's dashboard (see src/utils/offlineCache.ts for what this
// deliberately does NOT attempt — no offline mutations, no sync queue).

interface Course {
  _id: string;
  title: string;
  code?: string;
}

export default function CoursesScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShowingOfflineData, setIsShowingOfflineData] = useState(false);
  const [offlineCacheAge, setOfflineCacheAge] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
        },
        examsLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
        card: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        // Identical treatment to home.tsx's offline banner — same
        // dark/light background swap, same border color — so the
        // "you're offline" visual language is consistent across the
        // two screens that have it, not a one-off look invented here.
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
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        cardCode: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        spinner: { marginTop: Spacing.xl },
        errorText: { fontSize: 13, color: colors.textMuted },
      }),
    [colors]
  );

  const loadCourses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    const cacheKey = user?.id ? `courses_${user.id}` : null;
    try {
      const res = await api.get('/courses');
      const fetched = res.data?.data ?? [];
      setCourses(fetched);
      setIsShowingOfflineData(false);
      setOfflineCacheAge(null);
      if (cacheKey) cacheResponse(cacheKey, fetched);
    } catch (err: any) {
      const cached = cacheKey ? await getCachedResponse<Course[]>(cacheKey) : null;
      if (cached) {
        setCourses(cached.data);
        setIsShowingOfflineData(true);
        setOfflineCacheAge(formatCacheAge(cached.cachedAt));
      } else {
        const message =
          err?.response?.data?.message || 'Could not load courses. Pull down to try again.';
        setError(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCourses(true)} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          Courses
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/exams' as any)}
          accessibilityRole="button"
          accessibilityLabel="Exams"
        >
          <Text style={styles.examsLink}>Exams</Text>
        </TouchableOpacity>
      </View>
      <StatusBanner status="real" note="Courses are fetched live from your account." />

      {isShowingOfflineData ? (
        <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
          <Text style={styles.offlineBannerText}>
            {isOffline
              ? `📡 You're offline — showing saved courses from ${offlineCacheAge}.`
              : `📡 Couldn't reach the server — showing saved courses from ${offlineCacheAge}. Pull down to try again.`}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : courses.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardCode}>No courses yet.</Text>
        </View>
      ) : (
        courses.map((course) => (
          <TouchableOpacity
            key={course._id}
            style={styles.card}
            onPress={() => router.push(`/course/${course._id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={course.code ? `${course.title}, ${course.code}` : course.title}
          >
            <Text style={styles.cardTitle}>{course.title}</Text>
            {course.code ? <Text style={styles.cardCode}>{course.code}</Text> : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}
