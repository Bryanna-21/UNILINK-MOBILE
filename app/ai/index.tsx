import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: SHELL — this is a local-only chat UI. No LLM is called.
// A real version needs: (1) a backend proxy route (e.g. POST
// /api/ai/ask) so the LLM API key never lives in the mobile app,
// (2) a chosen provider (Anthropic/OpenAI/etc.), (3) rate limiting
// per user so costs stay bounded. None of that exists yet.

const CAPABILITIES = [
  'Summarize notes',
  'Explain a concept',
  'Generate a quiz',
  'Make flashcards',
  'Help plan an assignment',
  'Suggest a study timetable',
];

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function AiAssistantScreen() {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  const handleSend = () => {
    if (!draft.trim()) return;
    const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', text: draft.trim() };
    const fakeReply: LocalMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: "UNILINK AI isn't connected yet — this is a placeholder reply so the chat layout can be reviewed.",
    };
    setMessages((prev) => [...prev, userMsg, fakeReply]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <StatusBanner status="shell" note="No LLM is called. Needs a backend proxy route + provider decision." />

      {messages.length === 0 ? (
        <View style={styles.capabilitiesBox}>
          <Text style={styles.capabilitiesTitle}>UNILINK AI can (once built):</Text>
          {CAPABILITIES.map((c) => (
            <Text key={c} style={styles.capabilityItem}>• {c}</Text>
          ))}
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && { color: Colors.white },
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask something (not connected to a real AI yet)"
          placeholderTextColor={Colors.textMuted}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Ask</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  capabilitiesBox: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  capabilitiesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  capabilityItem: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  bubble: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 14,
    color: Colors.text,
  },
  composer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
