import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../api/client';
import { StatusBanner } from './StatusBanner';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL — POST /api/exams (create) and PUT /api/exams/:id
// (update) call the live backend. Field names and validation rules
// (title/courseId required, duration must be > 0, editing blocked
// once Published) all confirmed against exam.controller.js's
// createExam/updateExam directly, not assumed.
//
// Question shape matches Exam.js's questionSchema exactly: text,
// type (mcq | truefalse | essay | short), options (mcq only),
// correctAnswer, marks. No date picker package is installed in this
// project yet, so startTime/endTime use plain text ISO input
// (YYYY-MM-DDTHH:mm) rather than pulling in a new native dependency
// mid-build without sign-off — a real rough edge, not hidden here.

type QuestionType = 'mcq' | 'truefalse' | 'essay' | 'short';

interface QuestionDraft {
  key: string; // client-only, for list rendering — not sent to the backend
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  marks: string;
}

interface Course {
  _id: string;
  title: string;
  code: string;
}

function emptyQuestion(): QuestionDraft {
  return { key: `${Date.now()}-${Math.random()}`, text: '', type: 'mcq', options: ['', ''], correctAnswer: '', marks: '1' };
}

export default function ExamForm({ examId, defaultCourseId }: { examId?: string; defaultCourseId?: string }) {
  const id = examId;
  const isEdit = !!id;
  const colors = useColors();
  const styles = useStyles(colors);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(defaultCourseId || '');
  const [duration, setDuration] = useState('60');
  const [passMark, setPassMark] = useState('50');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);

  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    api
      .get('/courses')
      .then((res) => setCourses(res.data?.data ?? []))
      .catch(() => setCourses([]));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/exams/${id}`);
      const exam = res.data?.data;
      setTitle(exam.title || '');
      setDescription(exam.description || '');
      setCourseId(exam.courseId || '');
      setDuration(String(exam.duration ?? 60));
      setPassMark(String(exam.passMark ?? 50));
      setStartTime(exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '');
      setEndTime(exam.endTime ? new Date(exam.endTime).toISOString().slice(0, 16) : '');
      setExamStatus(exam.status || null);
      setQuestions(
        (exam.questions || []).map((q: any) => ({
          key: q._id || `${Date.now()}-${Math.random()}`,
          text: q.text || '',
          type: q.type || 'mcq',
          options: q.options && q.options.length ? q.options : ['', ''],
          correctAnswer: q.correctAnswer || '',
          marks: String(q.marks ?? 1),
        }))
      );
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load this exam.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (key: string) => setQuestions((prev) => prev.filter((q) => q.key !== key));

  const addOption = (key: string) =>
    updateQuestion(key, { options: [...(questions.find((q) => q.key === key)?.options || []), ''] });

  const updateOption = (key: string, index: number, value: string) => {
    const q = questions.find((qq) => qq.key === key);
    if (!q) return;
    const newOptions = [...q.options];
    newOptions[index] = value;
    updateQuestion(key, { options: newOptions });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please give this exam a title.');
      return;
    }
    if (!courseId) {
      Alert.alert('Course required', 'Please select a course.');
      return;
    }
    const durationNum = Number(duration);
    if (!durationNum || durationNum <= 0) {
      Alert.alert('Invalid duration', 'Duration must be a positive number of minutes.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      courseId,
      duration: durationNum,
      passMark: Number(passMark) || 50,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      questions: questions
        .filter((q) => q.text.trim())
        .map((q) => ({
          text: q.text.trim(),
          type: q.type,
          options: q.type === 'mcq' ? q.options.filter((o) => o.trim()) : undefined,
          correctAnswer: q.correctAnswer.trim(),
          marks: Number(q.marks) || 1,
        })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/exams/${id}`, payload);
      } else {
        await api.post('/exams', payload);
      }
      router.back();
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

  // Editing is blocked server-side once an exam is Published (see
  // updateExam's own check) — surfaced here up front rather than
  // letting the lecturer fill out a whole form only to have the save
  // rejected at the very end.
  if (isEdit && examStatus && examStatus !== 'Draft' && examStatus !== 'Upcoming') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          This exam is {examStatus} and can no longer be edited. Duplicate it instead to make changes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl * 2 }}>
      <Text style={styles.title} accessibilityRole="header">
        {isEdit ? 'Edit Exam' : 'New Exam'}
      </Text>
      <StatusBanner status="real" note="Saves to the live backend." />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Exam title *"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        accessibilityLabel="Exam title, required"
      />
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        accessibilityLabel="Exam description, optional"
      />

      <Text style={styles.label}>Course *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseRow}>
        {courses.map((c) => (
          <TouchableOpacity
            key={c._id}
            style={[styles.courseChip, courseId === c._id && styles.courseChipActive]}
            onPress={() => setCourseId(c._id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: courseId === c._id }}
            accessibilityLabel={`Course: ${c.title}`}
          >
            <Text style={[styles.courseChipText, courseId === c._id && styles.courseChipTextActive]}>{c.code}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Duration (min) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
            accessibilityLabel="Duration in minutes, required"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Pass mark (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={passMark}
            onChangeText={setPassMark}
            accessibilityLabel="Pass mark percentage"
          />
        </View>
      </View>

      <Text style={styles.label}>Start time (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={colors.textMuted}
        value={startTime}
        onChangeText={setStartTime}
        accessibilityLabel="Start time, format year-month-day-hour-minute, optional"
      />
      <Text style={styles.label}>End time (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={colors.textMuted}
        value={endTime}
        onChangeText={setEndTime}
        accessibilityLabel="End time, format year-month-day-hour-minute, optional"
      />

      <Text style={styles.sectionHeader}>Questions ({questions.length})</Text>
      {questions.map((q, idx) => (
        <View key={q.key} style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Q{idx + 1}</Text>
            <TouchableOpacity
              onPress={() => removeQuestion(q.key)}
              accessibilityRole="button"
              accessibilityLabel={`Remove question ${idx + 1}`}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Question text"
            placeholderTextColor={colors.textMuted}
            value={q.text}
            onChangeText={(v) => updateQuestion(q.key, { text: v })}
            multiline
            accessibilityLabel={`Question ${idx + 1} text`}
          />

          <View style={styles.typeRow}>
            {(['mcq', 'truefalse', 'short', 'essay'] as QuestionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, q.type === t && styles.typeChipActive]}
                onPress={() => updateQuestion(q.key, { type: t })}
                accessibilityRole="radio"
                accessibilityState={{ checked: q.type === t }}
                accessibilityLabel={`Question ${idx + 1} type: ${t}`}
              >
                <Text style={[styles.typeChipText, q.type === t && styles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {q.type === 'mcq' && (
            <>
              {q.options.map((opt, oIdx) => (
                <TextInput
                  key={oIdx}
                  style={styles.input}
                  placeholder={`Option ${oIdx + 1}`}
                  placeholderTextColor={colors.textMuted}
                  value={opt}
                  onChangeText={(v) => updateOption(q.key, oIdx, v)}
                  accessibilityLabel={`Question ${idx + 1}, option ${oIdx + 1}`}
                />
              ))}
              <TouchableOpacity
                onPress={() => addOption(q.key)}
                accessibilityRole="button"
                accessibilityLabel={`Add option to question ${idx + 1}`}
              >
                <Text style={styles.addOptionText}>+ Add option</Text>
              </TouchableOpacity>
            </>
          )}

          {(q.type === 'mcq' || q.type === 'truefalse' || q.type === 'short') && (
            <TextInput
              style={styles.input}
              placeholder="Correct answer"
              placeholderTextColor={colors.textMuted}
              value={q.correctAnswer}
              onChangeText={(v) => updateQuestion(q.key, { correctAnswer: v })}
              accessibilityLabel={`Question ${idx + 1}, correct answer`}
            />
          )}

          <Text style={styles.label}>Marks</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={q.marks}
            onChangeText={(v) => updateQuestion(q.key, { marks: v })}
            accessibilityLabel={`Question ${idx + 1}, marks`}
          />
        </View>
      ))}

      <TouchableOpacity
        style={styles.addQuestionButton}
        onPress={addQuestion}
        accessibilityRole="button"
        accessibilityLabel="Add question"
      >
        <Text style={styles.addQuestionText}>+ Add question</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={isEdit ? 'Save changes' : 'Create exam'}
        accessibilityState={{ disabled: saving, busy: saving }}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
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
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm, textAlign: 'center' },
        label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4, marginTop: Spacing.xs },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        courseRow: { marginBottom: Spacing.sm },
        courseChip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginRight: Spacing.sm,
        },
        courseChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        courseChipText: { fontSize: 13, color: colors.text },
        courseChipTextActive: { color: colors.white, fontWeight: '700' },
        row: { flexDirection: 'row', gap: Spacing.sm },
        rowItem: { flex: 1 },
        sectionHeader: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
        questionCard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        questionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
        questionNumber: { fontSize: 13, fontWeight: '800', color: colors.primary },
        removeText: { fontSize: 12, color: colors.danger, fontWeight: '700' },
        typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
        typeChip: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
        },
        typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        typeChipText: { fontSize: 12, color: colors.text },
        typeChipTextActive: { color: colors.white, fontWeight: '700' },
        addOptionText: { fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: Spacing.sm },
        addQuestionButton: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderStyle: 'dashed',
          borderRadius: Radius.md,
          alignItems: 'center',
          padding: Spacing.md,
          marginTop: Spacing.sm,
        },
        addQuestionText: { fontSize: 14, fontWeight: '700', color: colors.primary },
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
