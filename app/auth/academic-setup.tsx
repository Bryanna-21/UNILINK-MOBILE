import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  TextInput,
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
import LoadingSkeleton from '../../src/components/LoadingSkeleton';

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
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState(user?.universityId || '');
  const [universityQuery, setUniversityQuery] = useState('');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState(user?.campusId || '');
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [loadingCampuses, setLoadingCampuses] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(
    user?.yearOfStudy ?? null
  );
  const [selectedSemester, setSelectedSemester] = useState<number | null>(
    user?.semester ?? null
  );

  const [loadingCourses, setLoadingCourses] = useState(true);
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
        universityInput: {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.primary,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        universitySelected: {
          borderColor: colors.primary,
          backgroundColor: colors.surface,
          minHeight: 64,
          justifyContent: 'center',
        },
        universityDropdown: {
          marginTop: Spacing.xs,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          overflow: 'hidden',
        },
        universityOption: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        universityOptionText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
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
        loadingField: {
          width: '100%',
        },
        loadingChips: {
          flexDirection: 'row',
          gap: 10,
        },
        loadingCourses: {
          width: '100%',
        },
        loadingCourseGap: {
          marginTop: 10,
        },
        button: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.sm,
        },
        buttonText: {
          color: colors.white,
          fontSize: 16,
          fontWeight: '700',
        },
      }),
    [colors]
  );

  const filteredUniversities = useMemo(() => {
    const query = universityQuery.trim().toLowerCase();

    if (!query || universityId) {
      return [];
    }

    return universities
      .filter((university) =>
        university.name.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [universities, universityQuery, universityId]);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/auth/universities')
      .then((response) => {
        if (!cancelled) {
          setUniversities(
            Array.isArray(response.data?.data)
              ? response.data.data
              : []
          );
        }
      })
      .catch(() => {
        if (!cancelled) setUniversities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUniversities(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!universityId) {
      setCampuses([]);
      setCampusId('');
      setLoadingCampuses(false);

      return () => {
        cancelled = true;
      };
    }

    setLoadingCampuses(true);

    api
      .get(`/auth/universities/${universityId}/campuses`)
      .then((response) => {
        if (!cancelled) {
          const data = Array.isArray(response.data?.data)
            ? response.data.data
            : [];

          setCampuses(data);

          if (data.length === 0) {
            // This university has no separate campus records.
            setCampusId('');
          } else if (user?.campusId) {
            const exists = data.some(
              (campus: Campus) =>
                String(campus._id ?? campus.id) ===
                String(user.campusId)
            );

            if (exists) {
              setCampusId(user.campusId);
            } else {
              setCampusId('');
            }
          } else {
            setCampusId('');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCampuses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCampuses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [universityId]);

  useEffect(() => {
    if (!universityId || universities.length === 0) return;

    const university = universities.find(
      (item) =>
        String(item._id ?? item.id) === String(universityId)
    );

    if (university) {
      setUniversityQuery(university.name);
    }
  }, [universities, universityId]);

  useEffect(() => {
    let cancelled = false;

    if (!universityId) {
      setCourses([]);
      setSelectedCourseId('');
      setLoadingCourses(false);
      return () => {
        cancelled = true;
      };
    }

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

          // Never keep a course selected if it is no longer part of
          // the currently selected university.
          setSelectedCourseId((current) =>
            data.some(
              (course: Course) =>
                String(course._id) === String(current)
            )
              ? current
              : ''
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setCourses([]);
          setSelectedCourseId('');
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
  }, [universityId]);

  const campusRequired = campuses.length > 0;

  const handleContinue = async () => {
    if (
      !selectedCourse ||
      !selectedYear ||
      !selectedSemester ||
      !universityId ||
      (campusRequired && !campusId)
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
        universityId,
        campusId: campusRequired ? campusId : null,
        courseId: selectedCourse._id,
        programme: selectedCourse.title,
        yearOfStudy: selectedYear,
        semester: selectedSemester,
        onboardingCompleted: true,
      });

      const savedUser = profileResponse.data?.data;

      setUser({
        ...user,
        ...(savedUser || {}),
        universityId,
        campusId: campusRequired ? campusId : null,
        courseId: selectedCourse._id,
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
    !!universityId &&
    (!campusRequired || !!campusId) &&
    !saving;

  const handleContinuePress = () => {
    if (!universityId) {
      setError('Please select your university.');
      return;
    }

    if (campusRequired && !campusId) {
      setError('Please select your campus.');
      return;
    }

    if (!selectedCourse) {
      setError('Please select your course.');
      return;
    }

    if (!selectedYear) {
      setError('Please select your year of study.');
      return;
    }

    if (!selectedSemester) {
      setError('Please select your semester.');
      return;
    }

    setError('');
    handleContinue();
  };

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

          {loadingUniversities ? (
            <View style={styles.loadingField}>
              <LoadingSkeleton width="100%" height={56} radius={Radius.md} />
            </View>
          ) : universityId ? (
            <TouchableOpacity
              style={[styles.valueBox, styles.universitySelected]}
              onPress={() => {
                setUniversityId('');
                setUniversityQuery('');
                setCampusId('');
                setCampuses([]);
                setCourses([]);
                setSelectedCourseId('');
                setError('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Change university"
            >
              <Text style={styles.valueText}>
                {universities.find(
                  (item) =>
                    String(item._id ?? item.id) ===
                    String(universityId)
                )?.name || universityQuery || 'University'}
              </Text>
              <Text style={styles.helper}>Tap to change</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.universityInput}
                placeholder="Search for your university"
                placeholderTextColor={colors.textMuted}
                value={universityQuery}
                onChangeText={setUniversityQuery}
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel="Search for university"
              />

              {filteredUniversities.length > 0 ? (
                <View style={styles.universityDropdown}>
                  {filteredUniversities.map((university, index) => {
                    const id = String(university._id ?? university.id ?? '');
                    if (!id) return null;

                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.universityOption,
                        ]}
                        onPress={async () => {
                          const selectedId = String(
                            university._id ?? university.id ?? ''
                          );

                          if (!selectedId) return;

                          const previousUniversityId = universityId;
                          const previousUniversityQuery = universityQuery;

                          setError('');
                          setCampusId('');
                          setCampuses([]);
                          setCourses([]);
                          setSelectedCourseId('');

                          try {
                            // Persist the university first. This guarantees
                            // /courses/available is scoped to the new university.
                            await api.put('/profile/me', {
                              universityId: selectedId,
                              courseId: null,
                            });

                            setUniversityId(selectedId);
                            setUniversityQuery(university.name);
                          } catch (err: any) {
                            setUniversityId(previousUniversityId);
                            setUniversityQuery(previousUniversityQuery);

                            setError(
                              err?.response?.data?.message ||
                                'Could not save your university. Please try again.'
                            );
                          }
                        }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${university.name}`}
                      >
                        <Text
                          style={[
                            styles.universityOptionText,
                          ]}
                        >
                          {university.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : universityQuery.trim() ? (
                <Text style={styles.helper}>
                  No matching universities found.
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Campus</Text>

          {!universityId ? (
            <Text style={styles.helper}>
              Select your university first.
            </Text>
          ) : loadingCampuses ? (
            <View style={styles.loadingChips}>
              <LoadingSkeleton width={110} height={42} radius={21} />
              <LoadingSkeleton width={130} height={42} radius={21} />
              <LoadingSkeleton width={95} height={42} radius={21} />
            </View>
          ) : campuses.length === 0 ? (
            <Text style={styles.helper}>
              No active campuses are available for this university yet.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontal}
            >
              {campuses.map((campus) => {
                const id = String(campus._id ?? campus.id);
                const active = String(campusId) === id;

                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                    ]}
                    onPress={() => setCampusId(id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {campus.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Course</Text>

          {loadingCourses ? (
            <View style={styles.loadingCourses}>
              <LoadingSkeleton width="100%" height={64} radius={Radius.md} />
              <LoadingSkeleton
                width="100%"
                height={64}
                radius={Radius.md}
                style={styles.loadingCourseGap}
              />
              <LoadingSkeleton width="82%" height={64} radius={Radius.md} />
            </View>
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
          style={styles.button}
          onPress={handleContinuePress}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Continue to UniLink"
          accessibilityState={{
            disabled: !canContinue,
            busy: saving,
          }}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving your setup…' : 'Continue to UniLink'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
