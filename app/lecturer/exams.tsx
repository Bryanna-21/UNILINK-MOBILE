import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — every action here (list, publish, close, duplicate,
// delete) calls the real backend built two sessions ago. Ownership
// (exam.createdBy === req.user.id) and status-transition rules
// (Draft-only delete, Published-only close, questions-required
// publish) are all enforced server-side; this screen surfaces the
// real rejection message on failure rather than guessing at the
// rules itself.

type ExamStatus = 'Draft' | 'Upcoming' | 'Published' | 'Completed' | 'Archived';

interface Exam {
  _id: string;
  title: string;
  courseId: string;
  status: ExamStatus;
  duration: number;
  questions: unknown[];
}

export default function LecturerExamsScreen() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/exams/lecturer');
      setExams(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load your exams.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredExams = useMemo(
    () => (courseId ? exams.filter((e) => e.courseId === courseId) : exams),
    [exams, courseId]
  );

  const statusColor = (status: ExamStatus) => {
    if (status === 'Published') return colors.secondary;
    if (status === 'Completed' || status === 'Archived') return colors.textMuted;
    return colors.primary; // Draft, Upcoming
  };

  const runAction = async (examId: string, action: 'publish' | 'close' | 'duplicate' | 'delete') => {
    setBusyId(examId);
    try {
      if (action === 'publish') await api.patch(`/exams/${examId}/publish`);
      else if (action === 'close') await api.patch(`/exams/${examId}/close`);
      else if (action === 'duplicate') await api.post(`/exams/${examId}/duplicate`);
      else if (action === 'delete') await api.delete(`/exams/${examId}`);
      load();
    } catch (err: any) {
      Alert.alert('Could not complete action', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (exam: Exam) => {
    Alert.alert('Delete this exam?', `"${exam.title}" will be permanently deleted. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => runAction(exam._id, 'delete') },
    ]);
  };

  const renderItem = ({ item }: { item: Exam }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => router.push(`/lecturer/exam/${item._id}/edit` as any)}>
        <View style={styles.cardHeader}>
          <Text style={styles.examTitle}>{item.title}</Text>
          <View style={[styles.statusPill, { borderColor: statusColor(item.status) }]}>
            <Text style={[styles.statusPillText, { color: statusColor(item.status) }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {item.duration} min · {item.questions.length} question{item.questions.length === 1 ? '' : 's'}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        {(item.status === 'Draft' || item.status === 'Upcoming') && (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => runAction(item._id, 'publish')}
            disabled={busyId === item._id}
          >
            <Text style={styles.actionChipText}>Publish</Text>
          </TouchableOpacity>
        )}
        {item.status === 'Published' && (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => runAction(item._id, 'close')}
            disabled={busyId === item._id}
          >
            <Text style={styles.actionChipText}>Close</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionChip}
          onPress={() => runAction(item._id, 'duplicate')}
          disabled={busyId === item._id}
        >
          <Text style={styles.actionChipText}>Duplicate</Text>
        </TouchableOpacity>
        {item.status === 'Draft' && (
          <TouchableOpacity
            style={[styles.actionChip, styles.dangerChip]}
            onPress={() => confirmDelete(item)}
            disabled={busyId === item._id}
          >
            <Text style={[styles.actionChipText, styles.dangerChipText]}>Delete</Text>
          </TouchableOpacity>
        )}
        {busyId === item._id && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredExams}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={filteredExams.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Exams
            </Text>
            <StatusBanner status="real" note="Your exams, every status including drafts, from the live backend." />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}
            <TouchableOpacity
              style={styles.gradingLink}
              onPress={() => router.push('/lecturer/submissions' as any)}
            >
              <Text style={styles.gradingLinkText}>📋 View & grade submissions →</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No exams yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(courseId ? (`/lecturer/exam/new?courseId=${courseId}` as any) : ('/lecturer/exam/new' as any))}
        accessibilityRole="button"
        accessibilityLabel="Create a new exam"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
        listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        gradingLink: { marginBottom: Spacing.md },
        gradingLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        examTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1, marginRight: Spacing.sm },
        statusPill: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        statusPillText: { fontSize: 11, fontWeight: '700' },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm, alignItems: 'center' },
        actionChip: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
        },
        actionChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        dangerChip: { borderColor: colors.danger },
        dangerChipText: { color: colors.danger },
        emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
        fab: {
          position: 'absolute',
          right: Spacing.lg,
          bottom: Spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        fabText: { fontSize: 28, color: colors.white, fontWeight: '700', lineHeight: 30 },
      }),
    [colors]
  );
}
