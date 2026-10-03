import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { CreatePostSheet } from '../../src/components/CreatePostSheet';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — the campus feed. Search box on top, "+" button (bottom right) to create a
// text / photo / video post, and every post shows its author's profile picture and name.
// Posting itself lives in CreatePostSheet. Search is server-side (GET /posts/feed?q=) and
// matches post text, title and the author's name.

interface PostMedia {
  url: string;
  type: 'image' | 'video';
  publicId: string;
}

interface Post {
  _id: string;
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  title?: string;
  content?: string;
  media?: PostMedia[];
  likes: number;
  liked?: boolean;
  commentsCount: number;
  score: number;
  createdAt: string;
}

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

function InlineVideo({ uri, height }: { uri: string; height: number }) {
  const colors = useColors();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  const mediaStyle = useMemo(
    () => ({ width: '100%' as const, height, borderRadius: Radius.sm, backgroundColor: colors.border }),
    [colors, height]
  );

  return <VideoView player={player} style={mediaStyle} nativeControls fullscreenOptions={{ enable: true }} />;
}

// One attachment shows as before; several become a swipeable strip with a "2/4" counter,
// so every photo and video in a post can actually be seen (the old feed showed only the first).
function MediaStrip({ media }: { media: PostMedia[] }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const HEIGHT = 240;

  const itemStyle = { height: HEIGHT, borderRadius: Radius.sm, backgroundColor: colors.border };

  const renderItem = (m: PostMedia, w: number | '100%') =>
    m.type === 'video' ? (
      <View style={{ width: w }}>
        <InlineVideo uri={m.url} height={HEIGHT} />
      </View>
    ) : (
      <Image
        source={{ uri: m.url }}
        style={[itemStyle, { width: w }]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );

  if (media.length === 1) {
    return <View style={{ marginTop: Spacing.sm }}>{renderItem(media[0], '100%')}</View>;
  }

  return (
    <View
      style={{ marginTop: Spacing.sm }}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      accessibilityLabel={`${media.length} attachments, swipe to see more`}
    >
      {width > 0 && (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {media.map((m, i) => (
              <View key={`${m.url}-${i}`} style={{ width }}>
                {renderItem(m, width)}
              </View>
            ))}
          </ScrollView>
          <View style={stripStyles.badge}>
            <Text style={stripStyles.badgeText}>
              {index + 1}/{media.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const stripStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

export default function CommunityScreen() {
  const colors = useColors();
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Only the newest request may update the screen, so a slow reply for "ann" can never
  // overwrite the results for "anna".
  const requestId = useRef(0);
  const activeQuery = useRef('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.md,
        },
        headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
        headerAction: { fontSize: 13, fontWeight: '600', color: colors.primary },
        searchWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          paddingHorizontal: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          gap: Spacing.sm,
        },
        searchIcon: { fontSize: 15 },
        searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 11 },
        clearText: { fontSize: 16, color: colors.textMuted, paddingHorizontal: 4 },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        postCard: {
          backgroundColor: colors.surface,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
        authorName: { fontSize: 15, fontWeight: '700', color: colors.text },
        postTime: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
        postTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
        postContent: { fontSize: 15, color: colors.text, lineHeight: 21 },
        postFooter: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
        likeButton: { color: colors.textMuted, fontSize: 14 },
        commentCount: { color: colors.textMuted, fontSize: 14 },
        fab: {
          position: 'absolute',
          right: Spacing.lg,
          bottom: Spacing.lg,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        },
        fabIcon: { color: colors.white, fontSize: 32, lineHeight: 36, fontWeight: '400' },
      }),
    [colors]
  );

  const loadFeed = useCallback(async (q: string) => {
    const mine = ++requestId.current;
    try {
      const res = await api.get('/posts/feed', { params: q ? { q } : undefined });
      if (mine !== requestId.current) return;
      setPosts(res.data?.data || []);
      setError(null);
    } catch (err: any) {
      if (mine !== requestId.current) return;
      setError(err?.response?.data?.message || 'Could not load the feed.');
    } finally {
      if (mine === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsSearching(false);
      }
    }
  }, []);

  // Reload whenever the tab regains focus (e.g. returning from comments), keeping the search.
  useFocusEffect(
    useCallback(() => {
      loadFeed(activeQuery.current);
    }, [loadFeed])
  );

  // Debounced search. Under 2 characters means "no search": the server ignores shorter queries too.
  const firstRun = useRef(true);
  useEffect(() => {
    const trimmed = query.trim();
    activeQuery.current = trimmed.length >= 2 ? trimmed : '';
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => loadFeed(activeQuery.current), 350);
    return () => clearTimeout(timer);
  }, [query, loadFeed]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeed(activeQuery.current);
  };

  // Real toggle with an optimistic update, reconciled with the server's answer so two rapid
  // taps can't drift the count.
  const handleLike = async (postId: string) => {
    const post = posts.find((p) => p._id === postId);
    const wasLiked = post?.liked ?? false;

    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId ? { ...p, liked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 } : p
      )
    );

    try {
      const res = await api.post(`/posts/like/${postId}`);
      const serverPost = res.data?.data?.post;
      const serverLiked = res.data?.data?.liked;
      if (serverPost) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, likes: serverPost.likes, liked: serverLiked } : p))
        );
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, liked: wasLiked, likes: post?.likes ?? p.likes } : p))
      );
    }
  };

  const searching = activeQuery.current.length >= 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Community
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/community-hub' as any)}
          accessibilityRole="button"
          accessibilityLabel="Community Hub"
        >
          <Text style={styles.headerAction}>👥 Hub</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon} accessibilityElementsHidden importantForAccessibility="no">
          🔍
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts and people"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={50}
          accessibilityLabel="Search posts and people"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 110, gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              {searching ? `No posts match "${activeQuery.current}".` : 'No posts yet. Tap + to share something.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <TouchableOpacity
                style={styles.authorRow}
                onPress={() => router.push(`/user/${item.userId}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.authorName || 'this user'}'s profile`}
              >
                <Avatar name={item.authorName} uri={item.authorAvatarUrl} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {item.authorName || 'Unknown user'}
                  </Text>
                  <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>

              {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
              {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
              {item.media && item.media.length > 0 ? <MediaStrip media={item.media} /> : null}

              <View style={styles.postFooter}>
                <TouchableOpacity
                  onPress={() => handleLike(item._id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.liked ? 'Unlike' : 'Like'}, ${item.likes} ${item.likes === 1 ? 'like' : 'likes'}`}
                  accessibilityState={{ selected: !!item.liked }}
                >
                  <Text style={styles.likeButton}>
                    {item.liked ? '❤️' : '🤍'} {item.likes}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/post/${item._id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.commentsCount} ${item.commentsCount === 1 ? 'comment' : 'comments'}, view post`}
                >
                  <Text style={styles.commentCount}>💬 {item.commentsCount}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Create a post"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreatePostSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPosted={() => loadFeed(activeQuery.current)}
      />
    </View>
  );
}
