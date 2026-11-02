import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Radius, Spacing, useColors } from '../constants/theme';

// UniLink AI during a call. Two things, both private to the person using them:
//   Ask   - questions answered by the AI ("explain this", "word this politely")
//   Notes - type notes while you talk, then turn them into a short recap
// Nothing is saved on the server. An answer reaches the other person only if YOU press
// "Share in chat", which posts it to the conversation as a normal message from you.
//
// What is NOT here: the AI does not listen to the call or transcribe it. It works only from what
// you type.

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  callId: string;
  conversationId: string;
  notes: string;
  setNotes: (v: string) => void;
}

export function CallAiSheet({ visible, onClose, callId, conversationId, notes, setNotes }: Props) {
  const colors = useColors();
  const styles = useStyles(colors);

  const [tab, setTab] = useState<'ask' | 'notes'>('ask');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [recap, setRecap] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<FlatList<Turn>>(null);

  const call = async (body: Record<string, unknown>): Promise<string | null> => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.post(`/calls/${callId}/ai`, body);
      setRemaining(res.data?.data?.remainingToday ?? null);
      return res.data?.data?.reply ?? null;
    } catch (err: any) {
      setProblem(err?.response?.data?.message || 'The AI assistant could not answer. Try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    const history = turns.slice(-6);
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setQuestion('');
    const reply = await call({ mode: 'ask', message: q, history });
    if (reply) setTurns((t) => [...t, { role: 'assistant', content: reply }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const makeRecap = async () => {
    if (busy) return;
    const reply = await call({ mode: 'recap', notes });
    if (reply) setRecap(reply);
  };

  const share = (text: string, label: string) => {
    Alert.alert('Share in chat?', 'This posts the text to your conversation, where the other person can read it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Share',
        onPress: async () => {
          try {
            await api.post(`/messages/${conversationId}/messages`, { text: `${label}\n${text}`.slice(0, 2000) });
            Alert.alert('Shared', 'Posted to the chat.');
          } catch (err: any) {
            Alert.alert('Could not share', err?.response?.data?.message || 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>UniLink AI</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the AI assistant" hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {(['ask', 'notes'] as const).map((k) => (
              <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]} accessibilityRole="button" accessibilityState={{ selected: tab === k }}>
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{k === 'ask' ? 'Ask AI' : 'Notes and recap'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {problem ? <Text style={styles.error}>{problem}</Text> : null}

          {tab === 'ask' ? (
            <>
              <FlatList
                ref={listRef}
                data={turns}
                keyExtractor={(_, i) => String(i)}
                style={styles.list}
                contentContainerStyle={{ gap: Spacing.sm, padding: Spacing.md }}
                ListEmptyComponent={<Text style={styles.hint}>Ask anything while you talk: explain an idea, check a fact, word a reply. The other person cannot see this unless you share an answer.</Text>}
                renderItem={({ item }) => (
                  <View style={[styles.bubble, item.role === 'user' ? styles.mine : styles.theirs]}>
                    <Text style={[styles.bubbleText, item.role === 'user' && { color: colors.white }]}>{item.content}</Text>
                    {item.role === 'assistant' ? (
                      <TouchableOpacity onPress={() => share(item.content, 'AI answer:')} accessibilityRole="button" accessibilityLabel="Share this answer in the chat">
                        <Text style={styles.link}>Share in chat</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              />
              <View style={styles.inputRow}>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Ask UniLink AI"
                  placeholderTextColor={colors.textMuted}
                  maxLength={1000}
                  multiline
                  style={styles.input}
                  accessibilityLabel="Your question"
                />
                <TouchableOpacity onPress={ask} disabled={busy || !question.trim()} style={[styles.send, (busy || !question.trim()) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send question">
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Ask</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.notesWrap}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Type notes while you talk: decisions, who does what, dates..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={6000}
                style={styles.notesInput}
                accessibilityLabel="Call notes"
              />
              <TouchableOpacity onPress={makeRecap} disabled={busy || notes.trim().length < 20} style={[styles.primary, (busy || notes.trim().length < 20) && { opacity: 0.5 }]} accessibilityRole="button">
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Make AI recap</Text>}
              </TouchableOpacity>
              {recap ? (
                <View style={[styles.bubble, styles.theirs, { marginTop: Spacing.sm }]}>
                  <Text style={styles.bubbleText}>{recap}</Text>
                  <TouchableOpacity onPress={() => share(recap, 'Call recap:')} accessibilityRole="button" accessibilityLabel="Share this recap in the chat">
                    <Text style={styles.link}>Share in chat</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {remaining !== null ? <Text style={styles.footer}>{remaining} AI requests left today</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: colors.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, maxHeight: '85%', minHeight: '55%', paddingBottom: Spacing.md },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
        title: { fontSize: 18, fontWeight: '800', color: colors.text },
        close: { color: colors.primary, fontWeight: '700' },
        tabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md },
        tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { color: colors.text, fontWeight: '700', fontSize: 13 },
        tabTextOn: { color: colors.white },
        error: { color: colors.danger, fontSize: 13, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
        list: { flexGrow: 1 },
        hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: Spacing.lg },
        bubble: { borderRadius: Radius.md, padding: Spacing.md, maxWidth: '92%' },
        mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
        theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
        link: { color: colors.primary, fontWeight: '700', marginTop: Spacing.sm, fontSize: 13 },
        inputRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'flex-end' },
        input: { flex: 1, maxHeight: 110, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: colors.text, backgroundColor: colors.surface },
        send: { backgroundColor: colors.primary, borderRadius: Radius.md, height: 42, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
        sendText: { color: colors.white, fontWeight: '800' },
        notesWrap: { padding: Spacing.md },
        notesInput: { minHeight: 140, maxHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md, color: colors.text, backgroundColor: colors.surface, textAlignVertical: 'top', marginBottom: Spacing.sm },
        primary: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
        footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingTop: Spacing.sm },
      }),
    [colors]
  );
}
