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

// STATUS: REAL — calls GET/POST /api/community/courses/:courseId/discussion
// on the live backend. Fixed tonight, same as Comments earlier: the
// backend now attaches a real authorName via a batch User lookup
// (getDiscussionForCourse in community.controller.js), so entries show
// real names instead of "You" or a generic label, and are tappable
// through to the poster's profile.
//
// Note: the route param here is the courseId, not a discussion
// thread id — there's one discussion feed per course, not per-thread
// nesting (Discussion model has no parent/reply-to field).

interface DiscussionEntry {
  _id: string;
  courseId: string;
  userId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

export default function DiscussionScreen() {
  const colors = useColors();
  const { id: courseId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<DiscussionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        retryButton: {
          marginTop: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
        },
        retryText: { color: colors.white, fontWeight: '600' },
        replyCard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
        },
        replyAuthor: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
        replyText: { fontSize: 14, color: colors.text },
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
          maxHeight: 100,
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

  const loadDiscussion = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/community/courses/${courseId}/discussion`);
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
      const res = await api.post(`/community/courses/${courseId}/discussion`, { content });
      setEntries((prev) => [...prev, res.data.data]);
      setDraft('');
    } catch {
      // Keep the draft so nothing is lost on a failed post.
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <StatusBanner status="real" note="Discussion posts are saved to the real backend." />

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!isLoading && loadError && (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity onPress={loadDiscussion} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry">
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
            <Text style={styles.emptyText} accessibilityRole="text">
              No discussion posts yet. Be the first.
            </Text>
          }
          renderItem={({ item }) => {
            const isMe = item.userId === currentUser?.id;
            return (
              <View style={styles.replyCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/user/${item.userId}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${isMe ? 'your' : (item.authorName || 'this user') + "'s"} profile`}
                >
                  <Text style={styles.replyAuthor}>{isMe ? 'You' : item.authorName || 'Unknown user'}</Text>
                </TouchableOpacity>
                <Text style={styles.replyText}>{item.content}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Reply to this course's discussion"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!isPosting}
          accessibilityLabel="Reply to this course's discussion"
        />
        <TouchableOpacity
          style={[styles.postButton, isPosting && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={isPosting}
          accessibilityRole="button"
          accessibilityLabel="Post"
          accessibilityState={{ disabled: isPosting, busy: isPosting }}
        >
          {isPosting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.postButtonText}>Post</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
