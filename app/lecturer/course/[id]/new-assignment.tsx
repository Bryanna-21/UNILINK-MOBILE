import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../../src/api/client';
import { StatusBanner } from '../../../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../../../src/constants/theme';
import KeyboardSafe from '../../../../src/components/KeyboardSafe';

// STATUS: REAL — POST /api/courses/:courseId/assignments calls the
// live backend. dueDate uses plain ISO text input — no date picker
// package installed in this project yet (see ExamForm.tsx's own note
// on this same rough edge).

export default function NewAssignmentScreen() {
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please give this assignment a title.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/courses/${courseId}/assignments`, {
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        maxScore: Number(maxScore) || 100,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardSafe>
<ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <Text style={styles.title} accessibilityRole="header">
        New Assignment
      </Text>
      <StatusBanner status="real" note="Saves to the live backend. Students are notified automatically." />

      <TextInput style={styles.input} placeholder="Title *" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Instructions (optional)"
        placeholderTextColor={colors.textMuted}
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />
      <Text style={styles.label}>Due date (optional)</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DDTHH:mm" placeholderTextColor={colors.textMuted} value={dueDate} onChangeText={setDueDate} />
      <Text style={styles.label}>Max score</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={maxScore} onChangeText={setMaxScore} />

      <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Post Assignment</Text>}
      </TouchableOpacity>
    </ScrollView>
</KeyboardSafe>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: Spacing.sm },
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
        multiline: { minHeight: 100, textAlignVertical: 'top' },
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
