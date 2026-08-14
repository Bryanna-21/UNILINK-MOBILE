import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: SHELL — messages typed here are held in local component
// state only. Nothing is sent anywhere, nothing persists, no other
// device would ever see it. This exists purely to review the chat
// UI/IA.
//
// UPDATE: a socket.io server now exists on the backend (added for the
// Admin Panel's live notifications — see src/socket.js). It is NOT
// usable for this screen as-is: it only admits admin-role JWTs into
// its one "admins" room and has no student-facing events, message
// persistence, or Conversation/Message model. Real chat still needs
// its own model + student-facing socket namespace/room design, not
// just "call the same server" — but the "no real-time layer exists at
// all" framing is now out of date, so don't reuse that reasoning.

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<{ id: string; text: string }[]>([]);

  const handleSend = () => {
    if (!draft.trim()) return;
    setLocalMessages((prev) => [...prev, { id: Date.now().toString(), text: draft.trim() }]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <StatusBanner
        status="shell"
        note={`Chat "${id}" — messages are local-only. A socket.io server now exists on the backend (built for Admin Panel notifications), but it has no student-facing events or message storage yet. Still needs: a Message/Conversation model + real chat event wiring.`}
      />

      <FlatList
        data={localMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages. This chat isn't connected to anything real yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message (not sent anywhere)"
          placeholderTextColor={Colors.textMuted}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
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
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  bubble: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  bubbleText: {
    color: Colors.text,
    fontSize: 14,
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
