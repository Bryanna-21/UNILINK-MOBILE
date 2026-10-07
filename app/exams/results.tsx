import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

// STATUS: LIVE — GET /exams/results/me matches web's examService.js
// getStudentResults exactly.
//
// Deliberately NOT ported from web's Results.js: the "Download" and
// "Print Results" buttons. On web, downloadResult() only shows a toast
// saying "Downloading..." with no actual file produced, and
// printResult() calls window.print(), which has no native equivalent.
// Both are cosmetic on web, not real features — porting them here
// would mean building fake buttons on a second platform instead of
// one, which is a worse outcome than simply not having them.

interface ExamResult {
  _id: string;
  examTitle: string;
  status: 'Passed' | 'Failed';
  score: number;
  totalMarks: number;
  feedback?: string;
}

export default function ExamResultsScreen() {
  const colors = useColors();
  const [results, setResults] = useState<ExamResult[]>([]);
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
        backLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
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
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: Spacing.sm },
        statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
        statusText: { fontSize: 11, fontWeight: '700' },
        scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.sm, gap: 4 },
        scoreNumber: { fontSize: 22, fontWeight: '800', color: colors.text },
        scoreTotal: { fontSize: 14, color: colors.textMuted },
        scorePercent: { fontSize: 13, color: colors.textMuted, marginLeft: Spacing.xs },
        feedbackCard: {
          backgroundColor: colors.background,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.sm,
          marginTop: Spacing.sm,
        },
        feedbackLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
        feedbackText: { fontSize: 13, color: colors.text, marginTop: 4 },
        spinner: { marginTop: Spacing.xl },
        emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
        emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
      }),
    [colors]
  );

  const loadResults = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/exams/results/me');
      setResults(res.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load results.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const stats = {
    total: results.length,
    passed: results.filter((r) => r.status === 'Passed').length,
    failed: results.filter((r) => r.status === 'Failed').length,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadResults(true)} />}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          My Results
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/exams')}
          accessibilityRole="button"
          accessibilityLabel="Back to Exams"
        >
          <Text style={styles.backLink}>Back to Exams</Text>
        </TouchableOpacity>
      </View>
      <StatusBanner status="real" note="Results are fetched live from your account." />

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.passed}</Text>
          <Text style={styles.statLabel}>Passed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {isLoading ? (
        <LoadingSkeletonList rows={4} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No Results Found</Text>
          <Text style={styles.emptySubtext}>Your completed examinations will appear here.</Text>
        </View>
      ) : (
        results.map((result) => {
          const passed = result.status === 'Passed';
          const percent = result.totalMarks ? Math.round((result.score / result.totalMarks) * 100) : 0;
          return (
            <View key={result._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{result.examTitle}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: passed ? '#DCFCE7' : '#FEE2E2' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: passed ? '#166534' : '#991B1B' }]}>
                    {result.status}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreNumber}>{result.score}</Text>
                <Text style={styles.scoreTotal}>/ {result.totalMarks}</Text>
                <Text style={styles.scorePercent}>({percent}%)</Text>
              </View>

              {result.feedback ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackLabel}>Lecturer Feedback</Text>
                  <Text style={styles.feedbackText}>{result.feedback}</Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
