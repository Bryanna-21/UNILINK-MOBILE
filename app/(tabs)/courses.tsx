import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: LIVE — courses are fetched from GET /api/courses on the real
// backend (see src/api/client.ts for the base URL and auth wiring).
// The Course model, route, and controller already exist on
// UNILINK-BACKEND; this screen previously showed hardcoded placeholder
// data instead of calling it.

interface Course {
  _id: string;
  title: string;
  code?: string;
}

export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/courses');
      setCourses(res.data?.data ?? []);
    } catch (err: any) {
      // Cold-start retry already happens inside the api client itself;
      // if we land here, it genuinely failed after that retry.
      const message =
        err?.response?.data?.message || 'Could not load courses. Pull down to try again.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadCourses(true)} />
      }
    >
      <Text style={styles.title}>Courses</Text>
      <StatusBanner status="real" note="Courses are fetched live from your account." />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={Colors.primary} />
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
          >
            <Text style={styles.cardTitle}>{course.title}</Text>
            {course.code ? <Text style={styles.cardCode}>{course.code}</Text> : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: 0,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardCode: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  spinner: {
    marginTop: Spacing.xl,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
