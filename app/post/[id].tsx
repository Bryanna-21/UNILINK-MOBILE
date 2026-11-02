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
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import DocumentViewer from '../../src/components/DocumentViewer';
import { FeedVideo } from '../../src/components/SafeVideo';

// STATUS: REAL — GET /api/posts/:id for the post itself and GET/POST /api/posts/:id/comments for
// the comments, both on the live backend.
//
// This is where a post opens from a profile tile (and from anywhere else that links to /post/<id>).
// It used to show only the comments, so a document or a video opened from a profile could not be
// read. Now the whole post is shown first, the same way the Campus feed shows it (the text, then
// every photo, video and document, a document opened page by page), with the comments below.
//
// The server decides who may see a post (same university, not blocked). When it says no, this
// screen says the post is not available instead of showing an empty page.

interface PostMedia {
  url: string;
  type: 'image' | 'video' | 'document';
  publicId?: string;
}

interface PostDetail {
  _id: string;
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  title?: string;
  content?: string;
  media?: PostMedia[];
  likes?: number;
  commentsCount?: number;
  createdAt: string;
}

interface Comment {
  _id: string;
  postId: string;
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

const MEDIA_HEIGHT = 260;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// Every attachment, one under the other, full width. A document is opened inline (page 1 shows at
// once, swipe for the next page); a video starts on tap; a photo is shown whole.
function PostMediaList({ media }: { media: PostMedia[] }) {
  const colors = useColors();
  return (
    <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
      {media.map((m, i) => {
        if (m.type === 'video') {
          return <FeedVideo key={`${m.url}-${i}`} uri={m.url} height={MEDIA_HEIGHT} />;
        }
        if (m.type === 'document') {
          return <DocumentViewer key={`${m.url}-${i}`} media={m as any} />;
        }
        return (
          <Image
            key={`${m.url}-${i}`}
            source={{ uri: m.url }}
            style={{ width: '100%', height: MEDIA_HEIGHT, borderRadius: Radius.sm, backgroundColor: colors.border }}
            resizeMode="cover"
            accessibilityLabel="Photo in this post"
          />
        );
      })}
    </View>
  );
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const currentUser = useAuthStore((state) => state.user);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [postProblem, setPostProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setPostError(null);
    setCommentsError(null);

    // The post and its comments are loaded side by side, and one failing never hides the other.
    const [postResult, commentsResult] = await Promise.allSettled([
      api.get(`/posts/${id}`),
      api.get(`/posts/${id}/comments`),
    ]);

    if (postResult.status === 'fulfilled') {
      setPost(postResult.value.data?.data ?? null);
    } else {
      setPost(null);
      const status = (postResult.reason as any)?.response?.status;
      setPostError(
        status === 404 || status === 403
          ? 'This post is not available. It may have been deleted, or it is not visible to you.'
          : (postResult.reason as any)?.response?.data?.message || 'Could not load this post.'
      );
    }

    if (commentsResult.status === 'fulfilled') {
      setComments(commentsResult.value.data?.data ?? []);
    } else {
      setCommentsError((commentsResult.reason as any)?.response?.data?.message || 'Could not load comments.');
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePost = useCallback(async () => {
    const trimmed = content.trim();
    if (!id || !trimmed || isPosting) return;

    setIsPosting(true);
    setPostProblem(null);

    try {
      const res = await api.post(`/posts/${id}/comments`, { content: trimmed });
      if (res.data?.data) {
        setComments((prev) => [...prev, res.data.data]);
      }
      setContent('');
    } catch (err: any) {
      setPostProblem(err?.response?.data?.message || 'Could not post your comment.');
    } finally {
      setIsPosting(false);
    }
  }, [content, id, isPosting]);

  const header = (
    <View>
      {post && (
        <View style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => router.push(`/user/${post.userId}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`View ${post.authorName || 'this user'}'s profile`}
          >
            <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={42} />
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                {post.userId === currentUser?.id ? 'You' : post.authorName || 'Unknown user'}
              </Text>
              <Text style={[styles.postTime, { color: colors.textMuted }]}>{timeAgo(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>

          {post.title ? <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text> : null}
          {post.content ? <Text style={[styles.postContent, { color: colors.text }]}>{post.content}</Text> : null}
          {post.media && post.media.length > 0 ? <PostMediaList media={post.media} /> : null}
        </View>
      )}

      {postError && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{postError}</Text>
          <TouchableOpacity
            onPress={load}
            style={[styles.retryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!postError && (
        <Text style={[styles.commentsHeading, { color: colors.text }]} accessibilityRole="header">
          Comments{comments.length ? ` (${comments.length})` : ''}
        </Text>
      )}

      {commentsError && !postError && (
        <Text style={[styles.errorText, { color: colors.danger, textAlign: 'left' }]}>{commentsError}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior="padding">
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>Post</Text>
        <View style={{ width: 52 }} />
      </View>

      <StatusBanner status="real" note="The post and its comments come from the real backend." />

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={postError ? [] : comments}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            postError || commentsError ? null : (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No comments yet. Be the first to comment.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Avatar name={item.authorName} uri={item.authorAvatarUrl} size={34} />
              <View style={styles.commentBody}>
                <TouchableOpacity onPress={() => router.push(`/user/${item.userId}` as any)}>
                  <Text style={[styles.commentAuthor, { color: colors.text }]}>
                    {item.userId === currentUser?.id ? 'You' : item.authorName || 'Unknown user'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
              </View>
            </View>
          )}
        />
      )}

      {!postError && !isLoading && (
        <View style={[styles.composerWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {postProblem ? <Text style={[styles.errorText, { color: colors.danger, textAlign: 'left' }]}>{postProblem}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write a comment..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              editable={!isPosting}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <TouchableOpacity
              onPress={handlePost}
              disabled={!content.trim() || isPosting}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              style={[styles.postButton, { backgroundColor: content.trim() && !isPosting ? colors.primary : colors.border }]}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={[styles.postButtonText, { color: colors.background }]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 16, fontWeight: '700', width: 52 },
  topTitle: { fontSize: 17, fontWeight: '800' },
  listContent: { padding: Spacing.md, gap: Spacing.sm },
  postCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  authorName: { fontSize: 15, fontWeight: '700' },
  postTime: { fontSize: 12, marginTop: 2 },
  postTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.xs },
  postContent: { fontSize: 15, lineHeight: 22 },
  commentsHeading: { fontSize: 16, fontWeight: '800', marginTop: Spacing.sm, marginBottom: Spacing.xs },
  commentCard: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  commentText: { fontSize: 15, lineHeight: 21 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorContainer: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errorText: { textAlign: 'center', fontSize: 14 },
  retryButton: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  retryText: { fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, paddingVertical: Spacing.md },
  composerWrap: { borderTopWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
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
  postButton: { minWidth: 64, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  postButtonText: { fontWeight: '800' },
});
