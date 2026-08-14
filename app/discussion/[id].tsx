import { useState, useCallback, useEffect } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL — calls GET/POST /api/courses/:courseId/discussion on
// the live backend. Same shape/caveat as post comments: userId is a
// raw string with no populated name, so entries show "You" or a
// generic label rather than a fabricated name.
//
// Note: the route param here is the courseId, not a discussion
// thread id — there's one discussion feed per course, not per-thread
// nesting (Discussion model has no parent/reply-to field).

interface DiscussionEntry {
  _id: string;
  courseId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export default function DiscussionScreen() {
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<DiscussionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const loadDiscussion = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/courses/${courseId}/discussion`);
      setEntries(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load this discussion.');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadDiscussion();
  }, [loadDiscussion]);

  const handlePost = async () => {
    if (!draft.trim() || !courseId) return;
    const content = draft.trim();
    setIsPosting(true);
    try {
      const res = await api.post(`/courses/${courseId}/discussion`, { content });
      setEntries((prev) => [...prev, res.data.data]);
      setDraft('');
    } catch {
      // Keep the draft so nothing is lost on a failed post.
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBanner status="real" note="Discussion posts are saved to the real backend." />

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}

      {!isLoading && loadError && (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity onPress={loadDiscussion} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !loadError && (
        <FlatList
          data={entries}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No discussion posts yet. Be the first.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.replyCard}>
              <Text style={styles.replyAuthor}>
                {item.userId === currentUser?.id ? 'You' : 'Student'}
              </Text>
              <Text style={styles.replyText}>{item.content}</Text>
            </View>
          )}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Reply to this course's discussion"
          placeholderTextColor={Colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!isPosting}
        />
        <TouchableOpacity
          style={[styles.postButton, isPosting && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  retryButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  retryText: { color: Colors.white, fontWeight: '600' },
  replyCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  replyAuthor: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  replyText: { fontSize: 14, color: Colors.text },
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
    minWidth: 64,
    alignItems: 'center',
  },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { color: Colors.white, fontWeight: '700' },
});
