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

// STATUS: SHELL — replies typed here live in local state only.
// The spec suggested reusing Post infrastructure for this; that's a
// real, reasonable option, but no Discussion/Thread model or route
// exists yet, and Post as it stands has no "reply to" / threading
// concept — that would need a schema change, not just a new route.

interface LocalReply {
  id: string;
  text: string;
}

export default function DiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');
  const [replies, setReplies] = useState<LocalReply[]>([]);

  const handlePost = () => {
    if (!draft.trim()) return;
    setReplies((prev) => [...prev, { id: Date.now().toString(), text: draft.trim() }]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <StatusBanner
        status="shell"
        note={`Course "${id}" discussion — replies are local-only. Needs a Discussion/Thread model; Post model has no threading concept yet.`}
      />

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No replies yet. This thread isn't saved anywhere.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.replyCard}>
            <Text style={styles.replyText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Reply (not saved anywhere)"
          placeholderTextColor={Colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity style={styles.postButton} onPress={handlePost}>
          <Text style={styles.postButtonText}>Post</Text>
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
  replyCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  replyText: {
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
    maxHeight: 100,
  },
  postButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  postButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
