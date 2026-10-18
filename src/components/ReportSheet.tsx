import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { api } from '../api/client';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL. Report a message or a profile to UniLink administrators (POST /safety/reports). They
// review it, decide under the Community Standards, and the outcome is recorded. The person reported
// is not told who reported them. Categories come from GET /safety/config.

interface Category {
  id: string;
  label: string;
  description: string;
}

const FALLBACK: Category[] = [
  { id: 'harassment', label: 'Harassment or bullying', description: 'Targeting, humiliating or repeatedly bothering someone.' },
  { id: 'hate_speech', label: 'Hate speech', description: 'Attacking people for who they are.' },
  { id: 'threats_violence', label: 'Threats or violence', description: 'Threatening, encouraging or glorifying harm to people.' },
  { id: 'sexual_content', label: 'Sexual content', description: 'Explicit material, sexual harassment or sexual exploitation.' },
  { id: 'child_safety', label: 'Child safety', description: 'Anything that puts a child at risk.' },
  { id: 'scam_fraud', label: 'Scam or fraud', description: 'Deceiving people to take their money, data or accounts.' },
  { id: 'spam', label: 'Spam', description: 'Repetitive, unwanted or automated promotion and links.' },
];
const DANGER_CATEGORIES = ['threats_violence', 'child_safety', 'self_harm'];

let cachedCategories: Category[] | null = null;

interface Props {
  visible: boolean;
  onClose: () => void;
  entityType: 'message' | 'profile';
  entityId: string;
}

export function ReportSheet({ visible, onClose, entityType, entityId }: Props) {
  const colors = useColors();
  const [categories, setCategories] = useState<Category[]>(cachedCategories ?? FALLBACK);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [imminent, setImminent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ reference: string | null; duplicate: boolean } | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: colors.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, maxHeight: '90%' },
        title: { fontSize: 18, fontWeight: '800', color: colors.text },
        note: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginBottom: Spacing.md },
        option: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.sm, backgroundColor: colors.surface },
        optionOn: { borderColor: colors.primary, borderWidth: 2 },
        optionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
        optionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.sm, color: colors.text, minHeight: 64, textAlignVertical: 'top', marginTop: Spacing.sm },
        dangerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.md },
        dangerText: { flexShrink: 1, fontSize: 13, color: colors.danger, fontWeight: '600' },
        actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
        cancel: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        cancelText: { fontWeight: '700', color: colors.text },
        send: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: colors.danger, alignItems: 'center' },
        sendText: { fontWeight: '700', color: colors.white },
        thanks: { fontSize: 15, color: colors.text, marginTop: Spacing.md },
        ref: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.sm },
      }),
    [colors]
  );

  useEffect(() => {
    if (!visible) return;
    setCategory(null);
    setDescription('');
    setImminent(false);
    setDone(null);
    if (cachedCategories) return;
    api
      .get('/safety/config')
      .then((res) => {
        const list: Category[] = res.data?.data?.categories ?? res.data?.categories ?? [];
        if (list.length) {
          cachedCategories = list;
          setCategories(list);
        }
      })
      .catch(() => {});
  }, [visible]);

  const submit = async () => {
    if (!category || sending) return;
    setSending(true);
    try {
      const res = await api.post('/safety/reports', {
        entityType,
        entityId,
        category,
        description: description.trim() || undefined,
        imminent: imminent && DANGER_CATEGORIES.includes(category) ? true : undefined,
      });
      const d = res.data?.data ?? res.data ?? {};
      setDone({ reference: d.reference ?? null, duplicate: !!d.duplicate });
    } catch (err: any) {
      Alert.alert('Report not sent', err?.response?.data?.message || 'Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {done ? (
            <>
              <Text style={styles.title}>{done.duplicate ? 'Already reported' : 'Report sent'}</Text>
              <Text style={styles.thanks}>
                {done.duplicate
                  ? 'You have already reported this, and it is being looked at.'
                  : 'Thank you. UniLink administrators will review it under the Community Standards. The person you reported is not told who reported them.'}
              </Text>
              {done.reference && <Text style={styles.ref}>Reference: {done.reference}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
                  <Text style={styles.cancelText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {entityType === 'message' ? 'Report this message' : 'Report this profile'}
              </Text>
              <Text style={styles.note}>
                {entityType === 'message'
                  ? 'UniLink administrators will see this message and a few before it, so they can judge it in context. They will not see the rest of your chat. '
                  : 'UniLink administrators will review this profile. '}
                The person you report is not told that it was you.
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {categories.map((c) => (
                  <TouchableOpacity key={c.id} style={[styles.option, category === c.id && styles.optionOn]} onPress={() => setCategory(c.id)} accessibilityRole="radio" accessibilityState={{ selected: category === c.id }}>
                    <Text style={styles.optionLabel}>{c.label}</Text>
                    <Text style={styles.optionDesc}>{c.description}</Text>
                  </TouchableOpacity>
                ))}
                {category && DANGER_CATEGORIES.includes(category) && (
                  <View style={styles.dangerRow}>
                    <Text style={styles.dangerText}>Someone is in immediate danger. (If so, call 112 or 999 first.)</Text>
                    <Switch value={imminent} onValueChange={setImminent} accessibilityLabel="Someone is in immediate danger" />
                  </View>
                )}
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Anything else the reviewer should know? (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  accessibilityLabel="Details"
                />
              </ScrollView>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={sending} accessibilityRole="button">
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.send, (!category || sending) && { opacity: 0.5 }]} onPress={submit} disabled={!category || sending} accessibilityRole="button">
                  {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Send report</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
