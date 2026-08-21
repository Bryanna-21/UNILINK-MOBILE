import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBanner } from '../../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../../src/constants/theme';
import { api } from '../../../src/api/client';

// STATUS: REAL — GET /courses/:courseId/assignments. Lists real
// assignments for this course; tapping one opens the real detail/
// submission/grading screen at app/assignment/[id].tsx.

interface Assignment {
  _id: string;
  title: string;
  dueDate?: string;
  maxScore: number;
}

export default function CourseAssignmentsScreen() {
  const colors = useColors();
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        retryButton: {
          marginTop: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
        },
        retryText: { color: colors.white, fontWeight: '600' },
        card: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          gap: 4,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        metaRow: { flexDirection: 'row', gap: 12 },
        meta: { fontSize: 12, color: colors.textMuted },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/courses/${courseId}/assignments`);
      setAssignments(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load assignments.');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Assignments are pulled live for this course." />

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!isLoading && loadError && (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !loadError && (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No assignments posted for this course yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/assignment/${item._id}` as any)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.metaRow}>
                {!!item.dueDate && <Text style={styles.meta}>Due {new Date(item.dueDate).toLocaleDateString()}</Text>}
                <Text style={styles.meta}>Max {item.maxScore}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
