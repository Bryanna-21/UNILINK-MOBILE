import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL — GET /courses/cats/:id, GET /courses/cats/:catId/my-result,
// POST /courses/cats/:catId/results (lecturer/admin, publishes/updates a
// result for a specific studentId).
//
// Known rough edge, deliberate: publishing a result requires a
// studentId, and there is no backend endpoint that gives a lecturer
// student names for a course roster (only raw ObjectId strings live
// on Course.enrolledStudentIds) - so the lecturer-side publish form
// takes a raw student ID. Clunky, but functional; a roster-lookup
// endpoint would make this a picker instead of a text field.

interface Cat {
  _id: string;
  courseId: string;
  title: string;
  date?: string;
  venue?: string;
  coverage?: string;
  maxScore: number;
}

interface Result {
  _id: string;
  catId: string;
  studentId: string;
  score: number;
  feedback?: string;
  publishedAt: string;
}

export default function CatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const isPublisher = currentUser?.role === 'lecturer' || currentUser?.role === 'admin';

  const [cat, setCat] = useState<Cat | null>(null);
  const [myResult, setMyResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState('');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const catRes = await api.get(`/courses/cats/${id}`);
      setCat(catRes.data?.data ?? null);

      if (!isPublisher) {
        const resultRes = await api.get(`/courses/cats/${id}/my-result`);
        setMyResult(resultRes.data?.data ?? null);
      }
    } catch {
      setLoadError('Could not load this CAT.');
    } finally {
      setIsLoading(false);
    }
  }, [id, isPublisher]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async () => {
    const scoreNum = Number(score);
    if (!studentId.trim() || !score.trim() || Number.isNaN(scoreNum) || !id) return;
    setIsPublishing(true);
    setPublishMessage(null);
    try {
      await api.post(`/courses/cats/${id}/results`, {
        studentId: studentId.trim(),
        score: scoreNum,
        feedback: feedback.trim() || undefined,
      });
      setPublishMessage(`Result published for student ${studentId.trim()}.`);
      setStudentId('');
      setScore('');
      setFeedback('');
    } catch {
      setPublishMessage('Could not publish this result. Check the student ID and try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (loadError || !cat) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.emptyText}>{loadError ?? 'CAT not found.'}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
      <StatusBanner status="real" note="CAT details and results are saved to the real backend." />

      <View style={styles.card}>
        <Text style={styles.catTitle}>{cat.title}</Text>
        {!!cat.coverage && <Text style={styles.coverage}>{cat.coverage}</Text>}
        <View style={styles.metaRow}>
          {!!cat.date && <Text style={styles.meta}>{new Date(cat.date).toLocaleDateString()}</Text>}
          {!!cat.venue && <Text style={styles.meta}>{cat.venue}</Text>}
          <Text style={styles.meta}>Max score: {cat.maxScore}</Text>
        </View>
      </View>

      {!isPublisher && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your result</Text>
          {myResult ? (
            <View style={styles.gradeBanner}>
              <Text style={styles.gradeBannerText}>
                {myResult.score}/{cat.maxScore}
              </Text>
              {!!myResult.feedback && <Text style={styles.feedbackText}>{myResult.feedback}</Text>}
              <Text style={styles.meta}>
                Published {new Date(myResult.publishedAt).toLocaleDateString()}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No result published yet.</Text>
          )}
        </View>
      )}

      {isPublisher && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Publish a result</Text>
          <Text style={styles.roughEdgeNote}>
            Enter the student&apos;s account ID directly — there&apos;s no name lookup for this yet.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Student ID"
            placeholderTextColor={Colors.textMuted}
            value={studentId}
            onChangeText={setStudentId}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder={`Score (out of ${cat.maxScore})`}
            placeholderTextColor={Colors.textMuted}
            value={score}
            onChangeText={setScore}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Feedback (optional)"
            placeholderTextColor={Colors.textMuted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />

          {!!publishMessage && <Text style={styles.publishMessage}>{publishMessage}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, (!studentId.trim() || !score.trim()) && styles.disabledButton]}
            onPress={handlePublish}
            disabled={!studentId.trim() || !score.trim() || isPublishing}
          >
            {isPublishing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Publish result</Text>
            )}
          </TouchableOpacity>
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
  catTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  coverage: { fontSize: 14, color: Colors.text },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: Colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  gradeBanner: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  gradeBannerText: { fontSize: 18, fontWeight: '700', color: Colors.secondary },
  feedbackText: { fontSize: 13, color: Colors.text },
  roughEdgeNote: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.text },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  publishMessage: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  submitButton: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: Colors.white, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
});
