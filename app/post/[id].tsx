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

// STATUS: SHELL — the Post model already has a `commentsCount`
// field, but there is no Comment model and no route to create, list,
// or count real comments. This screen's counter is decorative; it
// does not reflect or update the real commentsCount on the backend.
// Comments typed here are local-only.

interface LocalComment {
  id: string;
  text: string;
}

export default function PostCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<LocalComment[]>([]);

  const handlePost = () => {
    if (!draft.trim()) return;
    setComments((prev) => [...prev, { id: Date.now().toString(), text: draft.trim() }]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <StatusBanner
        status="shell"
        note={`Post "${id}" — comments are local-only. Post.commentsCount exists on the backend but nothing updates it; no Comment model or route exists.`}
      />

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No comments yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <Text style={styles.commentText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment (not saved anywhere)"
          placeholderTextColor={Colors.textMuted}
          value={draft}
          onChangeText={setDraft}
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
  },
  commentCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  commentText: {
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
