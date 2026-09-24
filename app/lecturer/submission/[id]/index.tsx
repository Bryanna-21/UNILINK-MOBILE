import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../../src/api/client';
import { StatusBanner } from '../../../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../../../src/constants/theme';

// STATUS: REAL — GET /api/exams/submissions/:id and POST
// /api/exams/submissions/:id/grade call the live backend built two
// sessions ago. marks sent as {questionId: awardedMarks}, matching
// gradeExamSubmission's Object.entries(marks) loop exactly. The
// backend clamps each mark to the question's own maxMarks server-side
// regardless of what's sent — the client-side cap here is just for
// immediate feedback, not the actual enforcement.

interface Answer {
  questionId: string;
  question: string;
  maxMarks: number;
  response: string;
  marks: number;
}

interface SubmissionDetail {
  _id: string;
  student: { name: string; email: string; admissionNumber?: string; course: string | null } | null;
  exam: { title: string; duration: number };
  submittedAt: string;
  feedback: string;
  status: string;
  totalMarks: number | null;
  score: number | null;
  answers: Answer[];
}

export default function GradeSubmissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/exams/submissions/${id}`);
      const data: SubmissionDetail = res.data?.data;
      setSubmission(data);
      setFeedback(data.feedback || '');
      const initialMarks: Record<string, string> = {};
      data.answers.forEach((a) => {
        initialMarks[a.questionId] = String(a.marks || 0);
      });
      setMarks(initialMarks);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load this submission.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalAwarded = useMemo(
    () => Object.values(marks).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [marks]
  );

  const updateMark = (questionId: string, value: string, maxMarks: number) => {
    // Client-side clamp for immediate feedback only — the backend
    // re-clamps authoritatively on save regardless of what's sent.
    const num = Number(value);
    if (value !== '' && (isNaN(num) || num < 0)) return;
    if (!isNaN(num) && num > maxMarks) {
      setMarks((prev) => ({ ...prev, [questionId]: String(maxMarks) }));
      return;
    }
    setMarks((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const marksPayload: Record<string, number> = {};
      Object.entries(marks).forEach(([qId, val]) => {
        marksPayload[qId] = Number(val) || 0;
      });
      await api.post(`/exams/submissions/${id}/grade`, { marks: marksPayload, feedback: feedback.trim() });
      Alert.alert('Saved', 'Grade submitted.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!submission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Submission not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl * 2 }}>
      <Text style={styles.title} accessibilityRole="header">
        {submission.exam.title}
      </Text>
      <Text style={styles.subtitle}>
        {submission.student?.name}
        {submission.student?.admissionNumber ? ` · ${submission.student.admissionNumber}` : ''}
      </Text>
      {submission.student?.course && <Text style={styles.meta}>{submission.student.course}</Text>}

      <StatusBanner status="real" note="Grading saves to the live backend." />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      {submission.answers.map((a, idx) => (
        <View key={a.questionId} style={styles.questionCard}>
          <Text style={styles.questionNumber}>Q{idx + 1}</Text>
          <Text style={styles.questionText}>{a.question}</Text>
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>Response</Text>
            <Text style={styles.responseText}>{a.response || '(no answer given)'}</Text>
          </View>
          <View style={styles.marksRow}>
            <Text style={styles.marksLabel}>Marks (max {a.maxMarks})</Text>
            <TextInput
              style={styles.marksInput}
              keyboardType="numeric"
              value={marks[a.questionId] ?? ''}
              onChangeText={(v) => updateMark(a.questionId, v, a.maxMarks)}
            />
          </View>
        </View>
      ))}

      <Text style={styles.totalText}>
        Total: {totalAwarded} / {submission.totalMarks ?? 0}
      </Text>

      <Text style={styles.label}>Feedback (optional)</Text>
      <TextInput
        style={styles.feedbackInput}
        placeholder="Feedback for the student"
        placeholderTextColor={colors.textMuted}
        value={feedback}
        onChangeText={setFeedback}
        multiline
      />

      <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save Grade</Text>}
      </TouchableOpacity>
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
        subtitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        errorText: { color: colors.danger, fontSize: 13, marginVertical: Spacing.sm, textAlign: 'center' },
        questionCard: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginTop: Spacing.md,
        },
        questionNumber: { fontSize: 12, fontWeight: '800', color: colors.primary },
        questionText: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
        responseBox: {
          backgroundColor: colors.background,
          borderRadius: Radius.sm,
          padding: Spacing.sm,
          marginTop: Spacing.sm,
        },
        responseLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
        responseText: { fontSize: 13, color: colors.text, marginTop: 2 },
        marksRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
        marksLabel: { fontSize: 12, color: colors.textMuted },
        marksInput: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
          width: 70,
          textAlign: 'center',
          color: colors.text,
        },
        totalText: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, textAlign: 'right' },
        label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: Spacing.lg, marginBottom: 4 },
        feedbackInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          minHeight: 80,
          textAlignVertical: 'top',
        },
        saveButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          alignItems: 'center',
          padding: Spacing.md,
          marginTop: Spacing.lg,
        },
        saveButtonDisabled: { opacity: 0.5 },
        saveButtonText: { fontSize: 15, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
