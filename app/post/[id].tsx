import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL — calls GET/POST /api/posts/:postId/comments on the
// live backend. Comment model has no populated user name (userId is a
// raw string, no .populate() on the backend route) — so comments only
// show "You" for the current user's own comments, and a generic label
// otherwise, rather than fabricating a name that isn't there.

interface Comment {
  _id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export default function PostCommentsScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl },
        retryButton: {
          marginTop: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
        },
        retryText: { color: colors.white, fontWeight: '600' },
        commentCard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
        },
        commentAuthor: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
        commentText: { fontSize: 14, color: colors.text },
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
        postButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          justifyContent: 'center',
          minWidth: 64,
          alignItems: 'center',
        },
        postButtonDisabled: { opacity: 0.6 },
        postButtonText: { color: colors.white, fontWeight: '700' },
      }),
    [colors]
  );

  const loadComments = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/posts/${id}/comments`);
      setComments(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePost = async () => {
    if (!draft.trim() || !id) return;
    const content = draft.trim();
    setIsPosting(true);
    try {
      const res = await api.post(`/posts/${id}/comments`, { content });
      setComments((prev) => [...prev, res.data.data]);
      setDraft('');
    } catch {
      // Leave the draft text in place so nothing typed is lost on failure.
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBanner status="real" note="Comments are saved to the real backend." />

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!isLoading && loadError && (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity onPress={loadComments} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !loadError && (
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No comments yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.commentCard}>
              <Text style={styles.commentAuthor}>{item.userId === currentUser?.id ? 'You' : 'Student'}</Text>
              <Text style={styles.commentText}>{item.content}</Text>
            </View>
          )}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          editable={!isPosting}
        />
        <TouchableOpacity
          style={[styles.postButton, isPosting && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={isPosting}
        >
          {isPosting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.postButtonText}>Post</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
