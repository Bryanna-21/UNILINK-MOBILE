import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

interface Course {
  _id: string;
  title: string;
  code?: string;
  enrolledStudentIds: string[];
}

interface Student {
  _id: string;
  name: string;
  role: string;
}

export default function NewConversationScreen() {
  const colors = useColors();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [step, setStep] = useState<'course' | 'student'>('course');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const trimmedQuery = query.trim();
  const isSearchMode = step === 'course' && trimmedQuery.length >= 2;

  // Debounced name search (GET /profile/search). The `cancelled` flag
  // drops out-of-order responses: typing "ann" then "anna" must never
  // let the slower "ann" reply overwrite the "anna" results.
  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/profile/search', { params: { q: trimmedQuery } });
        if (!cancelled) {
          setResults(res.data?.data || []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || 'Search failed.');
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xl },
        title: { fontSize: 24, fontWeight: '800', color: colors.text },
        backLink: { fontSize: 15, fontWeight: '600', color: colors.primary },
        sectionLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textMuted,
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.sm,
        },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: {
          textAlign: 'center',
          color: colors.textMuted,
          marginTop: Spacing.xl,
          paddingHorizontal: Spacing.lg,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          gap: Spacing.sm,
        },
        rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        rowSubtitle: { fontSize: 12, color: colors.textMuted, marginLeft: 'auto' },
        searchInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.text,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
        },
        avatar: {
          width: 36,
          height: 36,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarText: { color: colors.white, fontWeight: '700', fontSize: 13 },
      }),
    [colors]
  );

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/courses');
      const all: Course[] = res.data?.data || [];
      const mine = all.filter((c) => Array.isArray(c.enrolledStudentIds) && c.enrolledStudentIds.includes(currentUserId || ''));
      setCourses(mine);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your courses.');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCourses();
    }, [currentUserId])
  );

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setStep('student');
    setIsLoading(true);
    try {
      const res = await api.get(`/courses/${course._id}/students`);
      const roster: Student[] = res.data?.data || [];
      setStudents(roster.filter((s) => s._id !== currentUserId));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the class roster.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const res = await api.post('/messages/start', { otherUserId: student._id });
      const conversationId = res.data?.data?._id;
      if (conversationId) {
        router.replace(`/chat/${conversationId}` as any);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not start the conversation.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleBack = () => {
    setStep('course');
    setSelectedCourse(null);
    setStudents([]);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {step === 'student' ? (
          <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back to Courses">
            <Text style={styles.backLink}>‹ Courses</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.title} accessibilityRole="header">
            New Message
          </Text>
        )}
      </View>

      <StatusBanner
        status="real"
        note="Search anyone at your university by name, or pick a course to message a classmate."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'course' ? (
        <TextInput
          style={styles.searchInput}
          placeholder="Search people by name"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          accessibilityLabel="Search people by name"
        />
      ) : null}

      {isSearchMode ? (
        isSearching && results.length === 0 ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
            ListEmptyComponent={
              <Text style={styles.emptyText} accessibilityRole="text">
                No one at your university matches "{trimmedQuery}".
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelectStudent(item)}
                disabled={isStarting}
                accessibilityRole="button"
                accessibilityLabel={`Message ${item.name}`}
                accessibilityState={{ disabled: isStarting }}
              >
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.role}</Text>
              </TouchableOpacity>
            )}
          />
        )
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : step === 'course' ? (
        <FlatList
          data={courses}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              You're not enrolled in any courses yet.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleSelectCourse(item)}
              accessibilityRole="button"
              accessibilityLabel={item.code ? `${item.title}, ${item.code}` : item.title}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.code ? <Text style={styles.rowSubtitle}>{item.code}</Text> : null}
            </TouchableOpacity>
          )}
        />
      ) : (
        <>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            {selectedCourse?.title}
          </Text>
          <FlatList
            data={students}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
            ListEmptyComponent={
              <Text style={styles.emptyText} accessibilityRole="text">
                No other students in this course yet.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelectStudent(item)}
                disabled={isStarting}
                accessibilityRole="button"
                accessibilityLabel={`Message ${item.name}`}
                accessibilityState={{ disabled: isStarting }}
              >
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.rowTitle}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}
