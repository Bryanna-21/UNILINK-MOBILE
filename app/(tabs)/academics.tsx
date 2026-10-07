import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { cacheResponse, getCachedResponse } from '../../src/utils/offlineCache';
import { useNetworkStatus } from '../../src/utils/useNetworkStatus';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

interface Course {
  _id: string;
  title: string;
  code?: string;
  description?: string;
  enrolledStudentIds?: string[];
}

export default function AcademicsScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStatus();

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
        },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          marginTop: 4,
        },
        sectionTitle: {
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
        },
        courseCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        courseCode: {
          fontSize: 13,
          fontWeight: '800',
          color: colors.primary,
          textTransform: 'uppercase',
        },
        courseTitle: {
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
          marginTop: 4,
        },
        courseDescription: {
          fontSize: 13,
          color: colors.textMuted,
          marginTop: 5,
          lineHeight: 19,
        },
        courseFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: Spacing.md,
          paddingTop: Spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        courseFooterText: {
          fontSize: 13,
          color: colors.textMuted,
        },
        courseChevron: {
          fontSize: 22,
          color: colors.textMuted,
        },
        loading: {
          marginTop: Spacing.xl,
        },
        error: {
          color: colors.danger,
          textAlign: 'center',
          marginHorizontal: Spacing.lg,
          marginTop: Spacing.lg,
          lineHeight: 20,
        },
        emptyCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.lg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
        },
        emptyText: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 20,
          marginTop: Spacing.sm,
        },
        retryButton: {
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.md,
          backgroundColor: colors.primary,
        },
        retryText: {
          color: colors.white,
          fontSize: 14,
          fontWeight: '700',
        },
        offlineText: {
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
          color: colors.textMuted,
          fontSize: 12,
        },
        bottomSpace: {
          height: Spacing.xl,
        },
      }),
    [colors]
  );

  const loadCourses = useCallback(
    async (useCacheFirst = true) => {
      if (!user?.id) {
        setCourses([]);
        setIsLoading(false);
        return;
      }

      const cacheKey = `courses_${user.id}`;

      if (useCacheFirst) {
        const cached = await getCachedResponse<Course[]>(cacheKey);
        if (Array.isArray(cached?.data)) {
          const enrolled = cached.data.filter(
            (course) =>
              Array.isArray(course.enrolledStudentIds) &&
              course.enrolledStudentIds.includes(user.id)
          );
          setCourses(enrolled);
          setIsLoading(false);
        }
      }

      try {
        const res = await api.get('/courses');
        const allCourses: Course[] = Array.isArray(res.data?.data) ? res.data.data : [];

        await cacheResponse(cacheKey, allCourses);

        const enrolled = allCourses.filter(
          (course) =>
            Array.isArray(course.enrolledStudentIds) &&
            course.enrolledStudentIds.includes(user.id)
        );

        setCourses(enrolled);
        setError(null);
      } catch (err: any) {
        if (courses.length === 0) {
          setError(err?.response?.data?.message || 'Could not load your courses.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id, courses.length]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadCourses(false);
  }, [loadCourses]);

  const openCourse = (courseId: string) => {
    router.push(`/course/${courseId}` as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Academics
          </Text>
          <Text style={styles.subtitle}>
            Your courses and everything you need for your studies.
          </Text>

        </View>

        {!isOnline && courses.length > 0 ? (
          <Text style={styles.offlineText}>
            Showing your saved courses. Pull down to refresh when you're online.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>
          My Courses
        </Text>

        {isLoading ? (
          <ActivityIndicator
            style={styles.loading}
            color={colors.primary}
          />
        ) : error && courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Couldn’t load your courses</Text>
            <Text style={styles.emptyText}>{error}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setIsLoading(true);
                loadCourses(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading courses"
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No courses linked to your account
            </Text>
            <Text style={styles.emptyText}>
              Once your course enrollment is linked to your UniLink account,
              your courses will appear here with their units and academic
              resources.
            </Text>
          </View>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course._id}
              style={styles.courseCard}
              onPress={() => openCourse(course._id)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${course.code ? `${course.code}, ` : ''}${course.title}`}
            >
              {course.code ? (
                <Text style={styles.courseCode}>{course.code}</Text>
              ) : null}

              <Text style={styles.courseTitle}>
                {course.title}
              </Text>

              {course.description ? (
                <Text style={styles.courseDescription} numberOfLines={2}>
                  {course.description}
                </Text>
              ) : null}

              <View style={styles.courseFooter}>
                <Text style={styles.courseFooterText}>
                  Units • Notes • Assignments • CATs • Past Papers
                </Text>
                <Text
                  style={styles.courseChevron}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  ›
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}
