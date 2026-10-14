import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/api/client';
import { useColors, Radius, Spacing } from '../../../src/constants/theme';

// STATUS: REAL. One school timetable: read it, comment, and approve or object while it is open for
// discussion (GET /school-timetables/:id, POST .../comments, PUT .../vote). You see vote totals and
// your own vote, not how colleagues voted. Once finalized it is read-only.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Entry { day: string; start: string; end: string; unitCode: string; unitName: string; lecturer: string; room: string }
interface Comment { id: string; userName: string; role: string; text: string; version: number; createdAt: string; mine: boolean }
interface Detail {
  id: string;
  title: string;
  term: string;
  status: 'published' | 'finalized';
  version: number;
  entries: Entry[];
  tally: { approve: number; object: number; responded: number; pending: number };
  myVote: { vote: 'approve' | 'object'; reason: string } | null;
  comments: Comment[];
}

export default function LecturerTimetableScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'approve' | 'object' | null>(null);
  const [reason, setReason] = useState('');
  const [savingVote, setSavingVote] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl },
        title: { fontSize: 20, fontWeight: '800', color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        banner: { marginTop: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        bannerText: { fontSize: 13, color: colors.text },
        section: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
        day: { fontSize: 12, fontWeight: '800', color: colors.primary, marginTop: Spacing.sm, textTransform: 'uppercase' },
        session: { marginTop: 4 },
        sessionMain: { fontSize: 14, color: colors.text },
        sessionMeta: { fontSize: 12, color: colors.textMuted },
        error: { color: colors.danger, fontSize: 13, marginTop: Spacing.sm },
        choices: { flexDirection: 'row', gap: Spacing.sm },
        choice: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
        choiceApprove: { backgroundColor: colors.primary, borderColor: colors.primary },
        choiceObject: { backgroundColor: colors.danger, borderColor: colors.danger },
        choiceText: { fontWeight: '700', color: colors.text },
        choiceTextOn: { color: colors.white },
        input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.sm, color: colors.text, marginTop: Spacing.sm, minHeight: 44 },
        primary: { marginTop: Spacing.sm, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
        primaryText: { color: colors.white, fontWeight: '700' },
        tally: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.sm },
        comment: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        commentMine: { borderColor: colors.primary },
        commentMeta: { fontSize: 11, color: colors.textMuted },
        commentText: { fontSize: 14, color: colors.text, marginTop: 2 },
        empty: { fontSize: 13, color: colors.textMuted },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/school-timetables/${id}`);
      const d: Detail = res.data?.data;
      setData(d);
      setChoice(d.myVote?.vote ?? null);
      setReason(d.myVote?.reason ?? '');
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load this timetable.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveVote = async () => {
    if (!choice) return;
    if (choice === 'object' && !reason.trim()) {
      Alert.alert('Say what you object to', 'An objection needs a reason, so the timetable can be fixed.');
      return;
    }
    setSavingVote(true);
    try {
      const res = await api.put(`/school-timetables/${id}/vote`, { vote: choice, reason: reason.trim() });
      setData((d) => (d ? { ...d, myVote: res.data.data.myVote, tally: res.data.data.tally } : d));
      Alert.alert('Saved', choice === 'approve' ? 'You approved this timetable.' : 'Your objection was recorded.');
    } catch (err: any) {
      Alert.alert('Could not save your vote', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSavingVote(false);
    }
  };

  const sendComment = async () => {
    const text = comment.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/school-timetables/${id}/comments`, { text });
      setData((d) => (d ? { ...d, comments: [...d.comments, res.data.data] } : d));
      setComment('');
    } catch (err: any) {
      Alert.alert('Comment not sent', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const open = data?.status === 'published';
  const byDay = DAYS.map((d) => ({ day: d, rows: (data?.entries ?? []).filter((e) => e.day === d) })).filter((g) => g.rows.length);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: data?.title || 'Timetable', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {data && (
          <>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.meta}>
              {data.term ? `${data.term} · ` : ''}version {data.version}
            </Text>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{open ? 'Open for discussion. Comment, and approve or object.' : 'This timetable is final. The discussion is closed.'}</Text>
            </View>

            <Text style={styles.section}>Timetable</Text>
            {byDay.length === 0 && <Text style={styles.empty}>No sessions.</Text>}
            {byDay.map((g) => (
              <View key={g.day}>
                <Text style={styles.day}>{g.day}</Text>
                {g.rows.map((e, i) => (
                  <View key={i} style={styles.session}>
                    <Text style={styles.sessionMain}>
                      {e.start}-{e.end}  {e.unitCode}
                      {e.unitName ? ` ${e.unitName}` : ''}
                    </Text>
                    {(e.lecturer || e.room) && (
                      <Text style={styles.sessionMeta}>{[e.lecturer, e.room].filter(Boolean).join(' · ')}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}

            <Text style={styles.section}>Your response</Text>
            <Text style={styles.tally}>
              {data.tally.approve} approved · {data.tally.object} objected · {data.tally.pending} waiting
            </Text>
            {open ? (
              <>
                <View style={[styles.choices, { marginTop: Spacing.sm }]}>
                  <TouchableOpacity style={[styles.choice, choice === 'approve' && styles.choiceApprove]} onPress={() => setChoice('approve')} accessibilityRole="button" accessibilityState={{ selected: choice === 'approve' }}>
                    <Text style={[styles.choiceText, choice === 'approve' && styles.choiceTextOn]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.choice, choice === 'object' && styles.choiceObject]} onPress={() => setChoice('object')} accessibilityRole="button" accessibilityState={{ selected: choice === 'object' }}>
                    <Text style={[styles.choiceText, choice === 'object' && styles.choiceTextOn]}>Object</Text>
                  </TouchableOpacity>
                </View>
                {choice && (
                  <TextInput
                    style={styles.input}
                    value={reason}
                    onChangeText={setReason}
                    placeholder={choice === 'object' ? 'What do you object to? (required)' : 'Add a note (optional)'}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={500}
                    accessibilityLabel="Reason"
                  />
                )}
                <TouchableOpacity style={[styles.primary, (!choice || savingVote) && { opacity: 0.5 }]} onPress={saveVote} disabled={!choice || savingVote} accessibilityRole="button">
                  {savingVote ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{data.myVote ? 'Update my response' : 'Send my response'}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.empty}>{data.myVote ? (data.myVote.vote === 'approve' ? 'You approved this timetable.' : 'You objected to this timetable.') : 'You did not respond.'}</Text>
            )}

            <Text style={styles.section}>Discussion</Text>
            {data.comments.length === 0 && <Text style={styles.empty}>No comments yet.</Text>}
            {data.comments.map((c) => (
              <View key={c.id} style={[styles.comment, c.mine && styles.commentMine]}>
                <Text style={styles.commentMeta}>
                  {c.userName} ({c.role}) · {new Date(c.createdAt).toLocaleString()}
                </Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))}
            {open && (
              <>
                <TextInput style={styles.input} value={comment} onChangeText={setComment} placeholder="Write a comment" placeholderTextColor={colors.textMuted} multiline maxLength={1000} accessibilityLabel="Comment" />
                <TouchableOpacity style={[styles.primary, (!comment.trim() || sending) && { opacity: 0.5 }]} onPress={sendComment} disabled={!comment.trim() || sending} accessibilityRole="button">
                  <Text style={styles.primaryText}>Post comment</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
