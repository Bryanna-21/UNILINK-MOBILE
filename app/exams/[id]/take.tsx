import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  BackHandler,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, Radius, Spacing } from '../../../src/constants/theme';
import { api } from '../../../src/api/client';
import KeyboardSafe from '../../../src/components/KeyboardSafe';

// STATUS: LIVE — POST /exams/:id/submit matches web's examService.js
// submitExam(examId, answers) exactly: an array of { questionId, answer }
// objects, not a map. GET /exams/:id matches getExamById.
//
// Deliberate differences from web's TakeExam.js, called out rather than
// silently dropped:
//   - No fullscreen mode. requestFullscreen() is a browser API with no
//     native equivalent — a mobile app is already the whole screen, so
//     this is a non-applicable web-only affordance, not a missing
//     feature.
//   - Answer auto-save uses AsyncStorage instead of localStorage, and
//     instead of SecureStore (which authStore.ts uses for the token) —
//     draft exam answers aren't credentials, so the lighter-weight,
//     unencrypted store is the right tool, not just a copy-paste of the
//     token pattern.
//   - The hardware back button is intercepted while an exam is in
//     progress. Web has no equivalent because a browser back button
//     during a timed exam is already an accepted, if awkward, part of
//     the web UX; on native, accidentally backing out mid-exam is a
//     one-tap accident. This intercept has no web counterpart to match
//     — it's an addition, not a port — and only asks for confirmation;
//     it does not block navigation outright.

type QuestionType = 'mcq' | 'truefalse' | 'essay' | 'short';

interface Question {
  _id: string;
  text: string;
  type: QuestionType;
  marks: number;
  options?: string[];
}

interface Exam {
  _id: string;
  title: string;
  courseId?: string;
  duration: number;
  questions: Question[];
}

export default function TakeExamScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const draftKey = exam ? `unilink_exam_draft_${exam._id}` : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        examTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
        examCourse: { fontSize: 12, color: colors.textMuted },
        timerBox: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: 6,
        },
        timerBoxUrgent: { borderColor: colors.danger },
        timerText: { fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
        timerTextUrgent: { color: colors.danger },
        progressBarTrack: {
          height: 4,
          backgroundColor: colors.border,
        },
        progressBarFill: {
          height: 4,
          backgroundColor: colors.secondary,
        },
        pager: {
          flexDirection: 'row',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          gap: Spacing.xs,
        },
        pagerDot: {
          width: 32,
          height: 32,
          borderRadius: Radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        pagerDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        pagerDotAnswered: { backgroundColor: colors.secondary, borderColor: colors.secondary },
        pagerDotText: { fontSize: 12, fontWeight: '700', color: colors.text },
        pagerDotTextActive: { color: colors.white },
        content: { flex: 1, padding: Spacing.md },
        questionCard: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
        },
        questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        questionNumber: { fontSize: 14, fontWeight: '700', color: colors.text },
        questionMarks: { fontSize: 12, color: colors.textMuted },
        questionText: { fontSize: 15, color: colors.text, marginTop: Spacing.sm, lineHeight: 21 },
        optionCard: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          padding: Spacing.md,
          marginTop: Spacing.sm,
          gap: Spacing.sm,
        },
        optionCardSelected: { borderColor: colors.primary, backgroundColor: colors.background },
        radioOuter: {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioOuterSelected: { borderColor: colors.primary },
        radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
        optionText: { fontSize: 14, color: colors.text, flex: 1 },
        textAnswer: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          padding: Spacing.md,
          marginTop: Spacing.sm,
          fontSize: 14,
          color: colors.text,
          minHeight: 140,
          textAlignVertical: 'top',
        },
        navRow: {
          flexDirection: 'row',
          gap: Spacing.sm,
          padding: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        navButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: Radius.md,
          alignItems: 'center',
        },
        navButtonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        navButtonPrimary: { backgroundColor: colors.primary },
        navButtonSuccess: { backgroundColor: colors.secondary },
        navButtonDisabled: { opacity: 0.4 },
        navButtonText: { fontWeight: '700', fontSize: 14, color: colors.text },
        navButtonTextLight: { fontWeight: '700', fontSize: 14, color: colors.white },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
        },
        modalCard: {
          backgroundColor: colors.surface,
          borderRadius: Radius.lg,
          padding: Spacing.lg,
          width: '100%',
        },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
        modalText: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.sm,
          marginBottom: Spacing.lg,
        },
        modalActions: { flexDirection: 'row', gap: Spacing.sm },
        loadingText: { color: colors.textMuted, marginTop: Spacing.sm },
      }),
    [colors]
  );

  const loadExam = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get(`/exams/${id}`);
      const data: Exam = res.data?.data;
      setExam(data);
      setTimeRemaining((data?.duration ?? 0) * 60);

      const key = `unilink_exam_draft_${data._id}`;
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        setAnswers(JSON.parse(saved));
      } else {
        const initial: Record<string, string> = {};
        data.questions.forEach((q) => {
          initial[q._id] = '';
        });
        setAnswers(initial);
      }
    } catch (err: any) {
      // Was: silently router.replace('/exams') on ANY error, discarding
      // the backend's actual message. A Published exam can still be
      // rejected by the backend if its start/end window hasn't opened
      // or has already closed — web shows that exact backend message
      // rather than doing its own client-side time-window check (it
      // has none either), so mobile should behave the same way instead
      // of silently bouncing the student with no explanation. This was
      // the real cause behind "blank screen, exam routes not found":
      // not a missing route, but a real rejection whose message never
      // reached the screen.
      setLoadError(err?.response?.data?.message || 'This exam could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  // Auto-save on every answer change, same intent as web's localStorage
  // effect — if the app is killed or crashes mid-exam, progress isn't
  // lost on relaunch.
  useEffect(() => {
    if (!draftKey) return;
    AsyncStorage.setItem(draftKey, JSON.stringify(answers)).catch(() => {
      // Best-effort. If this fails the exam still works for the current
      // session; only the crash-recovery safety net is degraded.
    });
  }, [answers, draftKey]);

  const handleSubmit = useCallback(async () => {
    if (!exam) return;
    try {
      setSubmitting(true);
      const formattedAnswers = Object.keys(answers).map((questionId) => ({
        questionId,
        answer: answers[questionId],
      }));
      await api.post(`/exams/${exam._id}/submit`, { answers: formattedAnswers });
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      router.replace('/exams/results');
    } catch (err: any) {
      setSubmitting(false);
      // Deliberately not silently swallowed — if submission genuinely
      // fails (network drop, expired session), the student needs to
      // know before they close the app. Re-shows the confirm dialog
      // isn't right either, since retry is still possible; simplest
      // honest option is a visible error surfaced via the modal itself
      // rather than a lost toast on unmount.
      setShowSubmitDialog(false);
      alertSubmitFailed();
    }
  }, [exam, answers, draftKey]);

  function alertSubmitFailed() {
    // Rare failure path (network loss at the exact moment of submit),
    // not a primary UI state worth a bespoke modal component.
    Alert.alert(
      'Submission Failed',
      'Your answers are saved on this device and were not lost. Check your connection and try submitting again.',
      [{ text: 'OK' }]
    );
  }

  // Countdown timer — auto-submits at zero, identical to web's behavior.
  useEffect(() => {
    if (!timeRemaining || submitting || loading) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining, submitting, loading, handleSubmit]);

  // Hardware back button confirmation — see file header note. This has
  // no web equivalent; it's a native-only addition, not a ported
  // feature, so it's flagged here rather than presented as parity.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (loading || submitting) return false;
      setShowExitDialog(true);
      return true;
    });
    return () => sub.remove();
  }, [loading, submitting]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading exam...</Text>
      </View>
    );
  }

  if (loadError || !exam) {
    return (
      <View style={styles.centered}>
        <Text style={styles.examTitle} accessibilityRole="header">
          Can't open this exam
        </Text>
        <Text style={[styles.loadingText, { marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.lg }]}>
          {loadError || 'This exam could not be loaded.'}
        </Text>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonPrimary, { marginTop: Spacing.lg, paddingHorizontal: Spacing.xl }]}
          onPress={() => router.replace('/exams')}
          accessibilityRole="button"
          accessibilityLabel="Back to Exams"
        >
          <Text style={styles.navButtonTextLight}>Back to Exams</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = exam.questions[currentQuestion];
  const answeredCount = Object.values(answers).filter((a) => a !== '' && a != null).length;
  const progress = exam.questions.length ? answeredCount / exam.questions.length : 0;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isUrgent = timeRemaining <= 60;

  const updateAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [question._id]: value }));
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case 'mcq':
        return (question.options ?? []).map((option, i) => {
          const selected = answers[question._id] === option;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => updateAnswer(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option}
            >
              <View
                style={[styles.radioOuter, selected && styles.radioOuterSelected]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          );
        });
      case 'truefalse':
        return ['True', 'False'].map((option) => {
          const selected = answers[question._id] === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => updateAnswer(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option}
            >
              <View
                style={[styles.radioOuter, selected && styles.radioOuterSelected]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          );
        });
      case 'essay':
      case 'short':
        return (
          <TextInput
            style={styles.textAnswer}
            placeholder="Write your answer..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={answers[question._id] ?? ''}
            onChangeText={updateAnswer}
            accessibilityLabel="Your answer"
          />
        );
      default:
        return <Text style={styles.questionText}>Unsupported question type.</Text>;
    }
  };

  const isLastQuestion = currentQuestion === exam.questions.length - 1;

  return (
    <KeyboardSafe>
<View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.examTitle} accessibilityRole="header">
            {exam.title}
          </Text>
          {exam.courseId ? <Text style={styles.examCourse}>{exam.courseId}</Text> : null}
        </View>
        <View
          style={[styles.timerBox, isUrgent && styles.timerBoxUrgent]}
          accessibilityLabel={`Time remaining: ${minutes} minutes ${seconds} seconds`}
          accessibilityLiveRegion={isUrgent ? 'assertive' : 'none'}
        >
          <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
        </View>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        accessibilityRole="tablist"
      >
        {exam.questions.map((q, index) => {
          const answered = !!answers[q._id];
          const active = index === currentQuestion;
          return (
            <TouchableOpacity
              key={q._id}
              style={[styles.pagerDot, active && styles.pagerDotActive, !active && answered && styles.pagerDotAnswered]}
              onPress={() => setCurrentQuestion(index)}
              accessibilityRole="tab"
              accessibilityLabel={`Question ${index + 1}${answered ? ', answered' : ', not answered'}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pagerDotText, active && styles.pagerDotTextActive]}>{index + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content}>
        <View style={styles.questionCard}>
          <View style={styles.questionTop}>
            <Text style={styles.questionNumber} accessibilityRole="header">
              Question {currentQuestion + 1}
            </Text>
            <Text style={styles.questionMarks}>{question.marks} Marks</Text>
          </View>
          <Text style={styles.questionText}>{question.text}</Text>
          <View
            accessibilityRole={question.type === 'mcq' || question.type === 'truefalse' ? 'radiogroup' : undefined}
          >
            {renderQuestionInput()}
          </View>
        </View>
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonSecondary, currentQuestion === 0 && styles.navButtonDisabled]}
          disabled={currentQuestion === 0}
          onPress={() => setCurrentQuestion((p) => p - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous question"
          accessibilityState={{ disabled: currentQuestion === 0 }}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        {isLastQuestion ? (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSuccess]}
            disabled={submitting}
            onPress={() => setShowSubmitDialog(true)}
            accessibilityRole="button"
            accessibilityLabel="Submit exam"
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={styles.navButtonTextLight}>Submit Exam</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonPrimary]}
            onPress={() => setCurrentQuestion((p) => p + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next question"
          >
            <Text style={styles.navButtonTextLight}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showSubmitDialog} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal accessibilityRole="alert">
            <Text style={styles.modalTitle} accessibilityRole="header">
              Submit Examination?
            </Text>
            <Text style={styles.modalText}>
              You have answered {answeredCount} of {exam.questions.length} questions.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonSecondary]}
                onPress={() => setShowSubmitDialog(false)}
                accessibilityRole="button"
                accessibilityLabel="Continue exam"
              >
                <Text style={styles.navButtonText}>Continue Exam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonSuccess]}
                disabled={submitting}
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Confirm submit"
                accessibilityState={{ disabled: submitting, busy: submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.navButtonTextLight}>Confirm Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showExitDialog} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal accessibilityRole="alert">
            <Text style={styles.modalTitle} accessibilityRole="header">
              Leave Exam?
            </Text>
            <Text style={styles.modalText}>
              Your answers are saved on this device, but the timer keeps running even if you leave.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonSecondary]}
                onPress={() => setShowExitDialog(false)}
                accessibilityRole="button"
                accessibilityLabel="Stay in exam"
              >
                <Text style={styles.navButtonText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonPrimary]}
                onPress={() => {
                  setShowExitDialog(false);
                  router.replace('/exams');
                }}
                accessibilityRole="button"
                accessibilityLabel="Leave exam"
              >
                <Text style={styles.navButtonTextLight}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
</KeyboardSafe>
  );
}
