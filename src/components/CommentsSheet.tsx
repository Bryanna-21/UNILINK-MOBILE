import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Avatar } from './Avatar';
import KeyboardSafe from './KeyboardSafe';
import { Radius, Spacing, useColors } from '../constants/theme';

// STATUS: REAL. Comments open in a sheet OVER the feed or reel (GET/POST /api/posts/:id/comments),
// so the person never leaves the place they were in. A reel keeps playing behind it, and closing
// the sheet returns to exactly where they were. Replaces the old full-page route for the feed.

interface Comment {
  _id: string;
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString();
}

export default function CommentsSheet({
  postId,
  onClose,
  onPosted,
}: {
  postId: string | null;
  onClose: () => void;
  onPosted?: (postId: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/posts/${id}/comments`);
      setComments(res.data?.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (postId) {
      setComments([]);
      setContent('');
      load(postId);
    }
  }, [postId, load]);

  const send = async () => {
    const text = content.trim();
    if (!postId || !text || posting) return;
    setPosting(true);
    setError('');
    try {
      await api.post(`/posts/${postId}/comments`, { content: text });
      setContent('');
      await load(postId); // reload so the new comment shows with the author's name
      onPosted?.(postId);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
          maxHeight: height * 0.75,
          minHeight: height * 0.45,
          backgroundColor: colors.background,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: insets.bottom,
        },
        handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
        title: { color: colors.text, fontSize: 16, fontWeight: '800' },
        close: { color: colors.textMuted, fontSize: 20, padding: 6 },
        row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm },
        name: { color: colors.text, fontSize: 13, fontWeight: '800' },
        time: { color: colors.textMuted, fontSize: 11 },
        body: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
        empty: { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        error: { color: colors.danger, fontSize: 13, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
        composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
        input: { flex: 1, maxHeight: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: colors.text, fontSize: 15 },
        send: { paddingHorizontal: Spacing.md, paddingVertical: 11, borderRadius: Radius.md, backgroundColor: colors.primary },
        sendText: { color: colors.white, fontWeight: '800' },
      }),
    [colors, height, insets.bottom]
  );

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments" />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">Comments</Text>
              <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments">
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading && comments.length === 0 ? (
              <ActivityIndicator style={{ marginVertical: Spacing.xl }} color={colors.primary} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c._id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}
                ListEmptyComponent={<Text style={styles.empty}>No comments yet. Be the first to say something.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <Avatar name={item.authorName} uri={item.authorAvatarUrl} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {item.authorName || 'Unknown user'} <Text style={styles.time}>· {timeAgo(item.createdAt)}</Text>
                      </Text>
                      <Text style={styles.body}>{item.content}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={content}
                onChangeText={setContent}
                placeholder="Add a comment…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={1000}
                editable={!posting}
                accessibilityLabel="Write a comment"
              />
              <TouchableOpacity
                style={[styles.send, (!content.trim() || posting) && { opacity: 0.5 }]}
                onPress={send}
                disabled={!content.trim() || posting}
                accessibilityRole="button"
                accessibilityLabel="Post comment"
              >
                {posting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Post</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}
