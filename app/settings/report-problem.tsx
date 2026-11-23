import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { sendFeedback, FEEDBACK_MAX, FEEDBACK_MIN, FeedbackCategory } from '../../src/api/feedback';
import { clearDraft, loadDraft, saveDraft } from '../../src/utils/formDraft';

// Report a problem, or send an idea. Opened from Settings, or by shaking the phone (the screen you were on is passed
// in `from`). The report carries the app version, the type of device and that screen name: the note below says so.
const CATEGORIES: { key: FeedbackCategory; label: string; hint: string }[] = [
  { key: 'bug', label: 'Something is broken', hint: 'What happened, and what did you expect?' },
  { key: 'idea', label: 'An idea', hint: 'What would make UniLink better for you?' },
  { key: 'other', label: 'Something else', hint: 'Tell us what is on your mind.' },
];
const DRAFT_KEY = 'report-problem';

export default function ReportProblemScreen() {
  const colors = useColors();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const loaded = useRef(false);

  // A half-written report survives the phone closing the app (kept on this device for a day, never sent).
  useEffect(() => {
    loadDraft<{ category: FeedbackCategory; message: string }>(DRAFT_KEY).then((d) => {
      if (d?.message) setMessage(String(d.message).slice(0, FEEDBACK_MAX));
      if (d?.category && CATEGORIES.some((c) => c.key === d.category)) setCategory(d.category);
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (!loaded.current || reference) return;
    const t = setTimeout(() => (message.trim() ? saveDraft(DRAFT_KEY, { category, message }) : clearDraft(DRAFT_KEY)), 500);
    return () => clearTimeout(t);
  }, [category, message, reference]);

  const length = message.trim().length;
  const tooShort = length < FEEDBACK_MIN;
  const hint = CATEGORIES.find((c) => c.key === category)?.hint ?? '';

  const submit = async () => {
    if (sending || tooShort) return;
    setSending(true);
    setError(null);
    const appVersion = String(Constants.expoConfig?.version ?? '');
    try {
      const result = await sendFeedback({
        category,
        message: message.trim(),
        context: {
          platform: Platform.OS,
          appVersion,
          screen: typeof from === 'string' ? from.slice(0, 80) : 'settings',
          userAgent: `UniLink/${appVersion} (${Platform.OS} ${String(Platform.Version)})`,
        },
      });
      await clearDraft(DRAFT_KEY);
      setReference(result.reference || 'sent');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send your report. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl },
        back: { paddingVertical: Spacing.sm },
        backText: { fontSize: 14, fontWeight: '700', color: colors.primary },
        title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: Spacing.xs },
        sub: { fontSize: 13, color: colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
        chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
        chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
        chipTextOn: { color: colors.primary },
        input: {
          minHeight: 150,
          textAlignVertical: 'top',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 15,
          color: colors.text,
        },
        count: { fontSize: 12, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
        note: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.sm, lineHeight: 17 },
        error: { fontSize: 13, color: colors.danger, marginTop: Spacing.sm },
        button: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md },
        buttonOff: { opacity: 0.45 },
        buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
        doneCard: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.lg, marginTop: Spacing.lg, alignItems: 'center' },
        doneTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
        doneText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
        ref: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: Spacing.md, letterSpacing: 1 },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">
        Report a problem
      </Text>

      {reference ? (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>Thank you</Text>
          <Text style={styles.doneText}>We have received your report and the UniLink team will read it. If you write to us about it, quote this reference:</Text>
          {reference !== 'sent' ? <Text style={styles.ref} selectable>{reference}</Text> : null}
          <TouchableOpacity style={[styles.button, { alignSelf: 'stretch' }]} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.sub}>Tell us what went wrong, or what you would like us to build. We read every one.</Text>

          <View style={styles.chips} accessibilityRole="radiogroup">
            {CATEGORIES.map((c) => {
              const on = c.key === category;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setCategory(c.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={c.label}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, FEEDBACK_MAX))}
            placeholder={hint}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={FEEDBACK_MAX}
            accessibilityLabel="Describe the problem"
          />
          <Text style={styles.count}>
            {length}/{FEEDBACK_MAX}
            {length > 0 && tooShort ? `  ·  at least ${FEEDBACK_MIN} characters` : ''}
          </Text>

          <Text style={styles.note}>
            Your report includes your account, the app version, the type of device and the name of the screen you were on
            (so we can find the problem). Please do not write passwords or other private details in it.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (tooShort || sending) && styles.buttonOff]}
            onPress={submit}
            disabled={tooShort || sending}
            accessibilityRole="button"
            accessibilityLabel="Send report"
            accessibilityState={{ disabled: tooShort || sending }}
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send report</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
