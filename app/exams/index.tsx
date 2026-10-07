import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

// STATUS: LIVE — GET /exams matches web's examService.js getStudentExams
// exactly (same endpoint, same backend, both return { data: Exam[] }).
// This is new mobile ground: the exam system existed on the backend and
// on web but had zero mobile screens until this file. Field shape below
// is read directly from web's ExamCard.js and TakeExam.js, not guessed.

type ExamStatus = 'Draft' | 'Published' | 'Upcoming' | 'Closed' | 'Completed';

interface Exam {
  _id: string;
  title: string;
  courseId?: string;
  description?: string;
  status: ExamStatus;
  duration: number;
  totalMarks: number;
  questions: { _id: string }[];
  startTime?: string;
  endTime?: string;
}

function formatDate(date?: string) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ExamsScreen() {
  const colors = useColors();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          paddingBottom: 0,
        },
        title: { fontSize: 24, fontWeight: '800', color: colors.text },
        resultsLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
        statsRow: {
          flexDirection: 'row',
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.md,
        },
        statCard: {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: Spacing.sm,
          alignItems: 'center',
        },
        statNumber: { fontSize: 18, fontWeight: '800', color: colors.text },
        statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
        card: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: Spacing.sm },
        cardCourse: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        statusBadge: {
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
          borderRadius: Radius.full,
        },
        statusText: { fontSize: 11, fontWeight: '700' },
        metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
        metaItem: {},
        metaLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
        metaValue: { fontSize: 13, color: colors.text, fontWeight: '600', marginTop: 1 },
        takeButton: {
          backgroundColor: colors.secondary,
          borderRadius: Radius.sm,
          paddingVertical: 10,
          alignItems: 'center',
          marginTop: Spacing.md,
        },
        takeButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        spinner: { marginTop: Spacing.xl },
        emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
        emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
      }),
    [colors]
  );

  const statusColors: Record<ExamStatus, { bg: string; text: string }> = {
    Published: { bg: '#DCFCE7', text: '#166534' },
    Upcoming: { bg: '#DBEAFE', text: '#1E40AF' },
    Completed: { bg: '#E2E8F0', text: '#334155' },
    Closed: { bg: '#FEE2E2', text: '#991B1B' },
    Draft: { bg: '#F1F5F9', text: '#475569' },
  };

  const loadExams = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/exams');
      setExams(res.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load exams.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const stats = {
    total: exams.length,
    available: exams.filter((e) => e.status === 'Published').length,
    completed: exams.filter((e) => e.status === 'Completed').length,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadExams(true)} />}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          My Exams
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/exams/results' as any)}
          accessibilityRole="button"
          accessibilityLabel="My Results"
        >
          <Text style={styles.resultsLink}>My Results</Text>
        </TouchableOpacity>
      </View>
      <StatusBanner status="real" note="Exams are fetched live from your account." />

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.available}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {isLoading ? (
        <LoadingSkeletonList rows={4} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : exams.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No exams available yet</Text>
          <Text style={styles.emptySubtext}>
            Your lecturer hasn't published any exams for your courses yet. Check back later.
          </Text>
        </View>
      ) : (
        exams.map((exam) => {
          const badge = statusColors[exam.status] ?? statusColors.Draft;
          return (
            // Plain View, not TouchableOpacity — was previously a
            // touchable wrapping a second touchable ("Take Exam"),
            // which is a real accessibility problem, not just a style
            // nitpick: nested touchables confuse a screen reader's
            // sense of what's actually tappable and where one target
            // ends and the next begins. The two real actions (view
            // detail, take exam) are now true siblings.
            <View key={exam._id} style={styles.card}>
              <TouchableOpacity
                onPress={() => router.push(`/exams/${exam._id}` as any)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View details: ${exam.title}, ${exam.status}, ${exam.duration} minutes, ${exam.totalMarks} marks`}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{exam.title}</Text>
                    {exam.courseId ? <Text style={styles.cardCourse}>{exam.courseId}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{exam.status}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Duration</Text>
                    <Text style={styles.metaValue}>{exam.duration} mins</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Marks</Text>
                    <Text style={styles.metaValue}>{exam.totalMarks}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Questions</Text>
                    <Text style={styles.metaValue}>{exam.questions?.length ?? 0}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Starts</Text>
                    <Text style={styles.metaValue}>{formatDate(exam.startTime)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {(() => {
                // Deliberately conservative: web has no equivalent
                // client-side check at all (it just shows the button
                // and lets the backend reject), so this isn't a ported
                // pattern — it's a genuine improvement, but scoped
                // narrowly to avoid disagreeing with rules only the
                // backend actually knows (timezone handling, grace
                // periods, endTime cutoffs). Only the unambiguous case
                // — a startTime that's clearly still in the future —
                // is checked here. Anything else (already started,
                // near a boundary, no startTime set) still shows the
                // real button and lets the backend's actual response
                // be the source of truth, same as web.
                const notYetOpen = exam.startTime ? new Date(exam.startTime).getTime() > Date.now() : false;

                if (exam.status !== 'Published') return null;

                if (notYetOpen) {
                  return (
                    <View style={[styles.takeButton, { backgroundColor: colors.border }]}>
                      <Text style={[styles.takeButtonText, { color: colors.textMuted }]}>
                        Opens {formatDate(exam.startTime)}
                      </Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    style={styles.takeButton}
                    onPress={() => router.push(`/exams/${exam._id}/take` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`Take exam: ${exam.title}`}
                  >
                    <Text style={styles.takeButtonText}>Take Exam</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
