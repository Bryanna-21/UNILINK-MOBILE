import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: REAL — POST /api/ai/ask, proxied through the backend so the
// OpenAI key never ships in the mobile app. Server enforces a daily
// per-user request cap (see ai.controller.js) and returns 429 with a
// clear message when hit, which this screen surfaces as-is rather
// than a generic error. Conversation history is NOT persisted
// server-side — only what's visible in this screen's own state is
// sent back as context on each request, capped to the last 10 turns
// server-side regardless of what's sent.

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}

const CAPABILITIES = [
  'Summarize notes',
  'Explain a concept',
  'Generate a quiz',
  'Make flashcards',
  'Help plan an assignment',
  'Suggest a study timetable',
];

export default function AiAssistantScreen() {
  const colors = useColors();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        capabilitiesBox: {
          margin: Spacing.md,
          padding: Spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        capabilitiesTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm },
        capabilityItem: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
        bubble: { borderRadius: Radius.md, padding: Spacing.md, maxWidth: '80%' },
        userBubble: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
        assistantBubble: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        },
        errorBubble: { backgroundColor: '#FEF2F2', borderColor: colors.danger },
        bubbleText: { fontSize: 14, color: colors.text },
        // Was an inline `{ color: Colors.white }` object literal spread
        // into the style array for user bubbles specifically — pulled
        // into a named style so it goes through the same themed styles
        // object as everything else, rather than sitting outside it.
        userBubbleText: { color: colors.white },
        errorBubbleText: { color: colors.danger },
        typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: 4 },
        typingText: { fontSize: 12, color: colors.textMuted },
        composer: {
          flexDirection: 'row',
          padding: Spacing.md,
          gap: Spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          fontSize: 14,
          color: colors.text,
        },
        sendButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
        sendButtonDisabled: { opacity: 0.5 },
        sendButtonText: { color: colors.white, fontWeight: '700' },
      }),
    [colors]
  );

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setIsSending(true);

    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await api.post('/ai/ask', { message: text, history });
      const reply: string = res.data?.data?.reply ?? 'No response received.';

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: reply },
      ]);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      const errorText =
        status === 429
          ? serverMessage ?? "You've reached today's AI request limit. Try again tomorrow."
          : serverMessage ?? 'Could not reach the AI assistant. Please try again.';

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: errorText, isError: true },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBanner status="real" note="Connected to a real AI assistant, proxied through the backend." />

      {messages.length === 0 ? (
        <View style={styles.capabilitiesBox}>
          <Text style={styles.capabilitiesTitle}>UNILINK AI can help you:</Text>
          {CAPABILITIES.map((c) => (
            <Text key={c} style={styles.capabilityItem}>• {c}</Text>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                item.isError && styles.errorBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && styles.userBubbleText,
                  item.isError && styles.errorBubbleText,
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />
      )}

      {isSending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.typingText}>Thinking…</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask UNILINK AI"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>Ask</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
