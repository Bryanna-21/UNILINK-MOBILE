import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../../src/api/client';
import { StatusBanner } from '../../../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../../../src/constants/theme';

// STATUS: REAL — GET /api/courses/assignments/:id,
// GET /api/courses/assignments/:assignmentId/submissions, and
// PATCH /api/courses/submissions/:id/grade all call the live backend.
//
// getSubmissionsForAssignment returns raw Submission documents with
// no student name joined in (Submission only stores studentId as a
// string) — names are resolved here by fetching the course roster
// once and matching by id client-side, rather than adding a new
// backend endpoint just for this join. Submission.textAnswer is the
// only response field on that model — this is a text-only submission
// system, no file attachments.

interface Assignment {
  _id: string;
  courseId: string;
  title: string;
  instructions?: string;
  dueDate?: string;
  maxScore: number;
}

interface Submission {
  _id: string;
  studentId: string;
  textAnswer?: string;
  submittedAt: string;
  grade: number | null;
  feedback?: string;
}

interface RosterStudent {
  _id: string;
  name: string;
}

function formatDate(iso?: string) {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const assignmentRes = await api.get(`/courses/assignments/${id}`);
      const assignmentData: Assignment = assignmentRes.data?.data;
      setAssignment(assignmentData);

      const [subsRes, rosterRes] = await Promise.all([
        api.get(`/courses/assignments/${id}/submissions`),
        api.get(`/courses/${assignmentData.courseId}/students`).catch(() => ({ data: { data: [] } })),
      ]);
      const subs: Submission[] = subsRes.data?.data ?? [];
      setSubmissions(subs);
      setRoster(rosterRes.data?.data ?? []);

      const drafts: Record<string, { grade: string; feedback: string }> = {};
      subs.forEach((s) => {
        drafts[s._id] = { grade: s.grade !== null ? String(s.grade) : '', feedback: s.feedback || '' };
      });
      setGradeDrafts(drafts);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load this assignment.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const studentName = (studentId: string) => roster.find((r) => r._id === studentId)?.name || 'Unknown student';

  const handleGrade = async (submissionId: string) => {
    const draft = gradeDrafts[submissionId];
    const gradeNum = Number(draft?.grade);
    if (draft?.grade === '' || isNaN(gradeNum)) {
      Alert.alert('Grade required', 'Please enter a numeric grade.');
      return;
    }
    setSavingId(submissionId);
    try {
      await api.patch(`/courses/submissions/${submissionId}/grade`, { grade: gradeNum, feedback: draft.feedback.trim() });
      load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Assignment not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <Text style={styles.title} accessibilityRole="header">
        {assignment.title}
      </Text>
      {!!assignment.instructions && <Text style={styles.instructions}>{assignment.instructions}</Text>}
      <Text style={styles.meta}>Due {formatDate(assignment.dueDate)} · {assignment.maxScore} pts max</Text>
      <StatusBanner status="real" note="Submissions and grading, from the live backend." />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      <Text style={styles.sectionHeader}>Submissions ({submissions.length})</Text>
      {submissions.length === 0 ? (
        <Text style={styles.emptyText}>No submissions yet.</Text>
      ) : (
        submissions.map((s) => (
          <View key={s._id} style={styles.submissionCard}>
            <Text style={styles.studentName}>{studentName(s.studentId)}</Text>
            <Text style={styles.meta}>Submitted {formatDate(s.submittedAt)}</Text>
            {!!s.textAnswer && (
              <View style={styles.answerBox}>
                <Text style={styles.answerText}>{s.textAnswer}</Text>
              </View>
            )}

            <View style={styles.gradeRow}>
              <TextInput
                style={styles.gradeInput}
                keyboardType="numeric"
                placeholder={`/ ${assignment.maxScore}`}
                placeholderTextColor={colors.textMuted}
                value={gradeDrafts[s._id]?.grade ?? ''}
                onChangeText={(v) => setGradeDrafts((prev) => ({ ...prev, [s._id]: { ...prev[s._id], grade: v } }))}
              />
              <TextInput
                style={styles.feedbackInput}
                placeholder="Feedback (optional)"
                placeholderTextColor={colors.textMuted}
                value={gradeDrafts[s._id]?.feedback ?? ''}
                onChangeText={(v) => setGradeDrafts((prev) => ({ ...prev, [s._id]: { ...prev[s._id], feedback: v } }))}
              />
            </View>
            <TouchableOpacity
              style={styles.gradeButton}
              onPress={() => handleGrade(s._id)}
              disabled={savingId === s._id}
            >
              {savingId === s._id ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.gradeButtonText}>{s.grade !== null ? 'Update Grade' : 'Submit Grade'}</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text },
        instructions: { fontSize: 14, color: colors.text, marginTop: Spacing.sm },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        errorText: { color: colors.danger, fontSize: 13, marginVertical: Spacing.sm, textAlign: 'center' },
        sectionHeader: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
        emptyText: { fontSize: 13, color: colors.textMuted },
        submissionCard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        studentName: { fontSize: 14, fontWeight: '700', color: colors.text },
        answerBox: { backgroundColor: colors.background, borderRadius: Radius.sm, padding: Spacing.sm, marginTop: Spacing.sm },
        answerText: { fontSize: 13, color: colors.text },
        gradeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        gradeInput: {
          width: 70,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          padding: Spacing.sm,
          textAlign: 'center',
          color: colors.text,
        },
        feedbackInput: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          padding: Spacing.sm,
          color: colors.text,
        },
        gradeButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.sm,
          alignItems: 'center',
          paddingVertical: Spacing.sm,
          marginTop: Spacing.sm,
        },
        gradeButtonText: { fontSize: 13, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
