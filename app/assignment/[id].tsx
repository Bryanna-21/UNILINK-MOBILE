import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL — GET /courses/assignments/:id, POST
// /courses/assignments/:assignmentId/submit, GET .../my-submission,
// GET .../submissions (lecturer/admin), PATCH /courses/submissions/:id/grade.
//
// Two distinct views on one screen, gated by role: students see the
// assignment + their own submission form; lecturers/admins see the
// assignment + a list of all submissions with a grading control. The
// backend's getSubmissionsForAssignment already 403s any non-lecturer/
// admin caller (verified in course.controller.js), so this is real
// security, not just a UI nicety - the client-side gate here only
// avoids showing a student a "Submissions" section that would fail.

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
  assignmentId: string;
  studentId: string;
  textAnswer: string;
  submittedAt: string;
  grade: number | null;
  feedback?: string;
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const isGrader = currentUser?.role === 'lecturer' || currentUser?.role === 'admin';

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const assignmentRes = await api.get(`/courses/assignments/${id}`);
      setAssignment(assignmentRes.data?.data ?? null);

      if (isGrader) {
        const subsRes = await api.get(`/courses/assignments/${id}/submissions`);
        setAllSubmissions(subsRes.data?.data ?? []);
      } else {
        const mineRes = await api.get(`/courses/assignments/${id}/my-submission`);
        const existing: Submission | null = mineRes.data?.data ?? null;
        setMySubmission(existing);
        if (existing) setAnswer(existing.textAnswer);
      }
    } catch {
      setLoadError('Could not load this assignment.');
    } finally {
      setIsLoading(false);
    }
  }, [id, isGrader]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!answer.trim() || !id) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/courses/assignments/${id}/submit`, { textAnswer: answer.trim() });
      setMySubmission(res.data.data);
    } catch {
      // leave the typed answer in place
    } finally {
      setIsSubmitting(false);
    }
  };

  const startGrading = (submission: Submission) => {
    setGradingId(submission._id);
    setGradeInput(submission.grade != null ? String(submission.grade) : '');
    setFeedbackInput(submission.feedback ?? '');
  };

  const handleGrade = async (submissionId: string) => {
    const gradeNum = Number(gradeInput);
    if (!gradeInput.trim() || Number.isNaN(gradeNum)) return;
    setIsGrading(true);
    try {
      const res = await api.patch(`/courses/submissions/${submissionId}/grade`, {
        grade: gradeNum,
        feedback: feedbackInput.trim() || undefined,
      });
      setAllSubmissions((prev) => prev.map((s) => (s._id === submissionId ? res.data.data : s)));
      setGradingId(null);
    } catch {
      // keep the grading form open
    } finally {
      setIsGrading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (loadError || !assignment) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.emptyText}>{loadError ?? 'Assignment not found.'}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
      <StatusBanner status="real" note="Assignment and submissions are saved to the real backend." />

      <View style={styles.card}>
        <Text style={styles.assignmentTitle}>{assignment.title}</Text>
        {!!assignment.instructions && <Text style={styles.instructions}>{assignment.instructions}</Text>}
        <View style={styles.metaRow}>
          {!!assignment.dueDate && (
            <Text style={styles.meta}>Due {new Date(assignment.dueDate).toLocaleDateString()}</Text>
          )}
          <Text style={styles.meta}>Max score: {assignment.maxScore}</Text>
        </View>
      </View>

      {!isGrader && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {mySubmission ? 'Your submission' : 'Submit your answer'}
          </Text>

          {mySubmission?.grade != null && (
            <View style={styles.gradeBanner}>
              <Text style={styles.gradeBannerText}>
                Graded: {mySubmission.grade}/{assignment.maxScore}
              </Text>
              {!!mySubmission.feedback && <Text style={styles.feedbackText}>{mySubmission.feedback}</Text>}
            </View>
          )}

          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Type your answer"
            placeholderTextColor={Colors.textMuted}
            value={answer}
            onChangeText={setAnswer}
            multiline
            editable={!isSubmitting}
          />

          <TouchableOpacity
            style={[styles.submitButton, !answer.trim() && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={!answer.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>{mySubmission ? 'Resubmit' : 'Submit'}</Text>
            )}
          </TouchableOpacity>

          {mySubmission && (
            <Text style={styles.meta}>
              Last submitted {new Date(mySubmission.submittedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {isGrader && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Submissions ({allSubmissions.length})
          </Text>

          {allSubmissions.length === 0 && (
            <Text style={styles.emptyText}>No submissions yet.</Text>
          )}

          <FlatList
            data={allSubmissions}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            renderItem={({ item }) => (
              <View style={styles.submissionCard}>
                <Text style={styles.studentIdText}>Student: {item.studentId}</Text>
                <Text style={styles.answerText}>{item.textAnswer}</Text>
                <Text style={styles.meta}>{new Date(item.submittedAt).toLocaleString()}</Text>

                {item.grade != null && gradingId !== item._id && (
                  <Text style={styles.gradedTag}>Graded: {item.grade}/{assignment.maxScore}</Text>
                )}

                {gradingId === item._id ? (
                  <View style={{ gap: 6, marginTop: 6 }}>
                    <TextInput
                      style={styles.input}
                      placeholder={`Score (out of ${assignment.maxScore})`}
                      placeholderTextColor={Colors.textMuted}
                      value={gradeInput}
                      onChangeText={setGradeInput}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      placeholder="Feedback (optional)"
                      placeholderTextColor={Colors.textMuted}
                      value={feedbackInput}
                      onChangeText={setFeedbackInput}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setGradingId(null)}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalSubmit, !gradeInput.trim() && styles.disabledButton]}
                        onPress={() => handleGrade(item._id)}
                        disabled={!gradeInput.trim() || isGrading}
                      >
                        {isGrading ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <Text style={styles.modalSubmitText}>Save grade</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.gradeLink} onPress={() => startGrading(item)}>
                    <Text style={styles.gradeLinkText}>
                      {item.grade != null ? 'Edit grade' : 'Grade this'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted },
  retryButton: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md },
  retryText: { color: Colors.white, fontWeight: '600' },
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: 8 },
  assignmentTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  instructions: { fontSize: 14, color: Colors.text },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  meta: { fontSize: 12, color: Colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  gradeBanner: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  gradeBannerText: { fontWeight: '700', color: Colors.secondary },
  feedbackText: { fontSize: 13, color: Colors.text },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.text },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  submitButton: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: Colors.white, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  submissionCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  studentIdText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  answerText: { fontSize: 14, color: Colors.text },
  gradedTag: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  gradeLink: { marginTop: 4 },
  gradeLinkText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  modalCancel: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.text, fontWeight: '600', fontSize: 13 },
  modalSubmit: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  modalSubmitText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
