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
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';

// STATUS: REAL — calls GET/POST /api/posts/:postId/comments on the
// live backend.

interface Comment {
  _id: string;
  postId: string;
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

export default function PostCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const currentUser = useAuthStore((state) => state.user);

  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await api.get(`/posts/${id}/comments`);
      setComments(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || 'Could not load comments.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePost = useCallback(async () => {
    const trimmed = content.trim();

    if (!id || !trimmed || isPosting) return;

    setIsPosting(true);

    try {
      const res = await api.post(`/posts/${id}/comments`, {
        content: trimmed,
      });

      if (res.data?.data) {
        setComments((prev) => [...prev, res.data.data]);
      }

      setContent('');
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || 'Could not post your comment.'
      );
    } finally {
      setIsPosting(false);
    }
  }, [content, id, isPosting]);

  return (
    <KeyboardAvoidingView
      style={styles.modalContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close comments"
      />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.sheetHandle,
            { backgroundColor: colors.border },
          ]}
        />

        <View
          style={[
            styles.sheetHeader,
            { borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            Comments
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            hitSlop={10}
          >
            <Text
              style={[
                styles.closeText,
                { color: colors.textMuted },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        <StatusBanner
          status="real"
          note="Comments are saved to the real backend."
        />

        {isLoading && (
          <View style={styles.centerFill}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!isLoading && loadError && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {loadError}
            </Text>

            <TouchableOpacity
              onPress={loadComments}
              style={[
                styles.retryButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text style={[styles.retryText, { color: colors.text }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !loadError && (
          <FlatList
            data={comments}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.listContent,
              comments.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.textMuted },
                ]}
              >
                No comments yet. Be the first to comment.
              </Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.commentCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Avatar
                  name={item.authorName}
                  uri={item.authorAvatarUrl}
                  size={34}
                />

                <View style={styles.commentBody}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(`/user/${item.userId}` as any)
                    }
                  >
                    <Text
                      style={[
                        styles.commentAuthor,
                        { color: colors.text },
                      ]}
                    >
                      {item.userId === currentUser?.id
                        ? 'You'
                        : item.authorName || 'Unknown user'}
                    </Text>
                  </TouchableOpacity>

                  <Text
                    style={[
                      styles.commentText,
                      { color: colors.text },
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        <View
          style={[
            styles.composer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            editable={!isPosting}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />

          <TouchableOpacity
            onPress={handlePost}
            disabled={!content.trim() || isPosting}
            style={[
              styles.postButton,
              {
                backgroundColor:
                  content.trim() && !isPosting
                    ? colors.primary
                    : colors.border,
              },
            ]}
          >
            {isPosting ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
              />
            ) : (
              <Text
                style={[
                  styles.postButtonText,
                  { color: colors.background },
                ]}
              >
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    height: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeText: {
    fontSize: 20,
    padding: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  commentCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 21,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: {
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  postButton: {
    minWidth: 64,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  postButtonText: {
    fontWeight: '800',
  },
});
