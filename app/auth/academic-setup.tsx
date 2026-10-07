import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

interface Course {
  _id: string;
  title: string;
  code?: string | null;
  description?: string;
}

interface University {
  _id?: string;
  id?: string;
  name: string;
}

interface Campus {
  _id?: string;
  id?: string;
  name: string;
  code?: string;
}

const YEARS = [1, 2, 3, 4, 5, 6];
const SEMESTERS = [1, 2, 3];

export default function AcademicSetupScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [courses, setCourses] = useState<Course[]>([]);
  const [universityName, setUniversityName] = useState('');
  const [campusName, setCampusName] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingContext, setLoadingContext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCourse = courses.find(
    (course) => String(course._id) === String(selectedCourseId)
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        content: {
          flexGrow: 1,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.xl,
        },
        title: {
          fontSize: 30,
          fontWeight: '800',
          color: colors.text,
          marginBottom: Spacing.xs,
        },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 20,
          marginBottom: Spacing.xl,
        },
        section: {
          marginBottom: Spacing.lg,
        },
        label: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        valueBox: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
        },
        valueText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        horizontal: {
          marginHorizontal: -Spacing.xs,
        },
        chip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 11,
          marginHorizontal: Spacing.xs,
        },
        chipActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        chipText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
        chipTextActive: {
          color: colors.white,
        },
        courseList: {
          gap: Spacing.sm,
        },
        course: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
        },
        courseActive: {
          borderColor: colors.primary,
          borderWidth: 2,
        },
        courseTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        courseCode: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
        helper: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 18,
        },
        error: {
          color: colors.danger,
          fontSize: 13,
          marginBottom: Spacing.md,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.sm,
        },
        buttonDisabled: {
          opacity: 0.55,
        },
        buttonText: {
          color: colors.white,
          fontSize: 16,
          fontWeight: '700',
        },
      }),
    [colors]
  );

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      if (!user?.universityId) {
        if (!cancelled) {
          setUniversityName('');
          setCampusName('');
          setLoadingContext(false);
        }
        return;
      }

      setLoadingContext(true);

      try {
        const universityResponse = await api.get('/auth/universities');
        const universities: University[] = Array.isArray(
          universityResponse.data?.data
        )
          ? universityResponse.data.data
          : [];

        const university = universities.find(
          (item) =>
            String(item._id ?? item.id) === String(user.universityId)
        );

        if (!cancelled) {
          setUniversityName(university?.name || 'University');
        }

        if (user.campusId) {
          const campusResponse = await api.get(
            `/auth/universities/${user.universityId}/campuses`
          );

          const campuses: Campus[] = Array.isArray(
            campusResponse.data?.data
          )
            ? campusResponse.data.data
            : [];

          const campus = campuses.find(
            (item) =>
              String(item._id ?? item.id) === String(user.campusId)
          );

          if (!cancelled) {
            setCampusName(campus?.name || 'Campus');
          }
        }
      } catch {
        if (!cancelled) {
          setUniversityName('University');
          setCampusName(user.campusId ? 'Campus' : '');
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    };

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [user?.universityId, user?.campusId]);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      setLoadingCourses(true);
      setError('');

      try {
        const response = await api.get('/courses/available');
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : [];

        if (!cancelled) {
          setCourses(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              'Could not load your courses. Please try again.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      }
    };

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async () => {
    if (
      !selectedCourse ||
      !selectedYear ||
      !selectedSemester ||
      !user
    ) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      // First associate the student with the actual course.
      await api.post(`/courses/${selectedCourse._id}/enroll`);

      // Then persist the student's academic profile.
      const profileResponse = await api.put('/profile/me', {
        programme: selectedCourse.title,
        yearOfStudy: selectedYear,
        semester: selectedSemester,
        onboardingCompleted: true,
      });

      const savedUser = profileResponse.data?.data;

      setUser({
        ...user,
        ...(savedUser || {}),
        programme: selectedCourse.title,
        yearOfStudy: selectedYear,
        semester: selectedSemester,
        onboardingCompletedAt:
          savedUser?.onboardingCompletedAt ||
          new Date().toISOString(),
      });

      router.replace('/(tabs)/home');
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Could not complete your academic setup. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const canContinue =
    !!selectedCourse &&
    !!selectedYear &&
    !!selectedSemester &&
    !saving &&
    !loadingContext;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Academic setup</Text>

        <Text style={styles.subtitle}>
          Tell UniLink what you are studying so we can show you the right
          academic content.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>University</Text>
          <View style={styles.valueBox}>
            {loadingContext ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.valueText}>
                {universityName || 'Not set'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Campus</Text>
          <View style={styles.valueBox}>
            {loadingContext ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.valueText}>
                {campusName || 'Not set'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Course</Text>

          {loadingCourses ? (
            <ActivityIndicator color={colors.primary} />
          ) : courses.length === 0 ? (
            <Text style={styles.helper}>
              No courses are available for your university yet.
            </Text>
          ) : (
            <View style={styles.courseList}>
              {courses.map((course) => {
                const active = course._id === selectedCourseId;

                return (
                  <TouchableOpacity
                    key={course._id}
                    style={[styles.course, active && styles.courseActive]}
                    onPress={() => setSelectedCourseId(course._id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={styles.courseTitle}>
                      {course.title}
                    </Text>

                    {course.code ? (
                      <Text style={styles.courseCode}>
                        {course.code}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Year of study</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontal}
          >
            {YEARS.map((year) => {
              const active = selectedYear === year;

              return (
                <TouchableOpacity
                  key={year}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedYear(year)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Semester</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontal}
          >
            {SEMESTERS.map((semester) => {
              const active = selectedSemester === semester;

              return (
                <TouchableOpacity
                  key={semester}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedSemester(semester)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {semester}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to UniLink"
          accessibilityState={{
            disabled: !canContinue,
            busy: saving,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Continue to UniLink</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
