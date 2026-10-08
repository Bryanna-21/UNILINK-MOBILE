import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
  Linking,
  Dimensions,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { CreatePostSheet } from '../../src/components/CreatePostSheet';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import LoadingSkeleton, { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

// STATUS: REAL — the campus feed. Search box on top, "+" button (bottom right) to create a
// text / photo / video post, and every post shows its author's profile picture and name.
// Posting itself lives in CreatePostSheet. Search is server-side (GET /posts/feed?q=) and
// matches post text, title and the author's name.

function FeedActionIcon({
  type,
  color,
  size = 20,
}: {
  type: 'reshare' | 'hide';
  color: string;
  size?: number;
}) {
  if (type === 'reshare') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M17 3l4 4-4 4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3 11V9a2 2 0 0 1 2-2h16"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M7 21l-4-4 4-4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M21 13v2a2 2 0 0 1-2 2H3"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M10.6 5.4A9.8 9.8 0 0 1 12 5.3c5 0 8.7 3.5 10 6.7a10.7 10.7 0 0 1-3.2 4.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.2 6.2C3.8 7.8 2.5 10 2 12c1.3 3.2 5 6.7 10 6.7 1.2 0 2.4-.2 3.4-.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}

interface PostMedia {
  url: string;
  type: 'image' | 'video' | 'document';
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

function ReelPlayer({
  uri,
  active,
  style,
}: {
  uri: string;
  active: boolean;
  style: any;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function MediaStrip({ media }: { media: PostMedia[] }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const HEIGHT = 240;

  const itemStyle = { height: HEIGHT, borderRadius: Radius.sm, backgroundColor: colors.border };

  const renderItem = (m: PostMedia, w: number | '100%') => {
    if (m.type === 'video') {
      return (
        <View style={{ width: w }}>
          <InlineVideo uri={m.url} height={HEIGHT} />
        </View>
      );
    }

    if (m.type === 'document') {
      return (
        <TouchableOpacity
          style={[
            itemStyle,
            {
              width: w,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: Spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          onPress={() => Linking.openURL(m.url)}
          accessibilityRole="button"
          accessibilityLabel="Open document"
        >
          <Text style={{ fontSize: 46 }}>📄</Text>
          <Text
            style={{
              marginTop: Spacing.sm,
              fontSize: 16,
              fontWeight: '800',
              color: colors.text,
            }}
          >
            Document
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              color: colors.textMuted,
              textAlign: 'center',
            }}
          >
            Tap to open
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <Image
        source={{ uri: m.url }}
        style={[itemStyle, { width: w }]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  };

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

export default function CampusScreen() {
  const colors = useColors();
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<'reels' | 'chronicles'>('chronicles');
  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  const reels = useMemo(
    () =>
      posts.filter((post) =>
        post.media?.some((media) => media.type === 'video')
      ),
    [posts]
  );

  const reelViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const onReelViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item?: Post }> }) => {
      const active = viewableItems[0]?.item;
      setActiveReelId(active?._id ?? null);
    }
  ).current;

  const chronicles = useMemo(
    () =>
      posts.filter((post) => {
        const media = post.media ?? [];
        return !media.some(
          (item) => item.type === 'video' || item.type === 'document'
        );
      }),
    [posts]
  );

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
        modeBar: {
          flexDirection: 'row',
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 3,
        },
        modeButton: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: Radius.sm,
        },
        modeButtonActive: {
          backgroundColor: colors.primary,
        },
        modeButtonText: {
          color: colors.textMuted,
          fontSize: 14,
          fontWeight: '700',
        },
        modeButtonTextActive: {
          color: colors.white,
        },
        reelsList: {
          flex: 1,
          backgroundColor: '#000',
        },
        reelPage: {
          height: WINDOW_HEIGHT,
          backgroundColor: '#000',
          position: 'relative',
        },
        reelVideo: {
          ...StyleSheet.absoluteFill,
          backgroundColor: '#000',
        },
        reelOverlay: {
          ...StyleSheet.absoluteFill,
          justifyContent: 'flex-end',
          padding: Spacing.md,
        },
        reelAuthor: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: Spacing.sm,
        },
        reelAuthorText: {
          color: colors.white,
          fontSize: 15,
          fontWeight: '800',
          marginLeft: Spacing.sm,
        },
        reelCaption: {
          color: colors.white,
          fontSize: 15,
          lineHeight: 21,
          marginBottom: Spacing.md,
          maxWidth: '82%',
        },
        reelActions: {
          position: 'absolute',
          right: Spacing.md,
          bottom: Spacing.xl,
          alignItems: 'center',
          gap: Spacing.md,
        },
        reelAction: {
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 48,
        },
        reelActionText: {
          color: colors.white,
          fontSize: 12,
          fontWeight: '700',
          marginTop: 3,
        },
        reelEmpty: {
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Spacing.xl,
        },
        reelEmptyText: {
          color: colors.white,
          textAlign: 'center',
          fontSize: 15,
          lineHeight: 22,
        },
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
        postFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          marginTop: Spacing.sm,
        },
        postAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          minHeight: 32,
        },
        likeButton: { color: colors.textMuted, fontSize: 14 },
        commentCount: { color: colors.textMuted, fontSize: 14 },
        actionLabel: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: '600',
        },
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
      const nextPosts = Array.isArray(res.data?.data) ? [...res.data.data] : [];
      nextPosts.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
      setPosts(nextPosts);
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

  const handleReshare = async (postId: string) => {
    try {
      const res = await api.post(`/posts/reshare/${postId}`);
      const message = res.data?.message || 'Post reshared successfully.';
      Alert.alert('Reshared', message);
      await loadFeed(activeQuery.current);
    } catch (err: any) {
      Alert.alert(
        'Could not reshare',
        err?.response?.data?.message || 'This post could not be reshared.'
      );
    }
  };

  const handleHide = async (postId: string) => {
    try {
      await api.post(`/posts/hidden/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err: any) {
      Alert.alert(
        'Could not hide post',
        err?.response?.data?.message || 'This post could not be hidden.'
      );
    }
  };

  const searching = activeQuery.current.length >= 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Campus
        </Text>
      </View>

      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeButton, feedMode === 'reels' && styles.modeButtonActive]}
          onPress={() => setFeedMode('reels')}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedMode === 'reels' }}
        >
          <Text style={[styles.modeButtonText, feedMode === 'reels' && styles.modeButtonTextActive]}>
            Reels
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, feedMode === 'chronicles' && styles.modeButtonActive]}
          onPress={() => setFeedMode('chronicles')}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedMode === 'chronicles' }}
        >
          <Text style={[styles.modeButtonText, feedMode === 'chronicles' && styles.modeButtonTextActive]}>
            Chronicles
          </Text>
        </TouchableOpacity>
      </View>

      {feedMode === 'chronicles' ? (
        <>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon} accessibilityElementsHidden importantForAccessibility="no">
              🔍
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search chronicles and people"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              maxLength={50}
              accessibilityLabel="Search chronicles and people"
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
            <LoadingSkeletonList rows={4} />
          ) : (
            <FlatList
              data={chronicles}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: Spacing.md, paddingBottom: 110, gap: Spacing.sm }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <Text style={styles.emptyText} accessibilityRole="text">
                  {searching ? `No chronicles match "${activeQuery.current}".` : 'No chronicles yet. Tap + to share something.'}
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
                      style={styles.postAction}
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
                      style={styles.postAction}
                      onPress={() => router.push(`/post/${item._id}` as any)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.commentsCount} ${item.commentsCount === 1 ? 'comment' : 'comments'}, view post`}
                    >
                      <Text style={styles.commentCount}>💬 {item.commentsCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.postAction}
                      onPress={() => handleReshare(item._id)}
                      accessibilityRole="button"
                      accessibilityLabel="Reshare post"
                    >
                      <FeedActionIcon type="reshare" color={colors.textMuted} />
                      <Text style={styles.actionLabel}>Reshare</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.postAction}
                      onPress={() =>
                        Alert.alert(
                          'Hide post?',
                          'This post will be removed from your feed.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Hide', style: 'destructive', onPress: () => handleHide(item._id) },
                          ]
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Hide post"
                    >
                      <FeedActionIcon type="hide" color={colors.textMuted} />
                      <Text style={styles.actionLabel}>Hide</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </>
      ) : isLoading ? (
        <View style={styles.reelEmpty}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.reelEmpty}>
          <Text style={styles.reelEmptyText}>
            No Reels yet. Tap + to share a video with campus.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.reelsList}
          data={reels}
          keyExtractor={(item) => item._id}
          pagingEnabled
          snapToInterval={WINDOW_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: WINDOW_HEIGHT,
            offset: WINDOW_HEIGHT * index,
            index,
          })}
          viewabilityConfig={reelViewabilityConfig}
          onViewableItemsChanged={onReelViewableItemsChanged}
          renderItem={({ item }) => {
            const video = item.media?.find((media) => media.type === 'video');

            if (!video) return null;

            return (
              <View style={styles.reelPage}>
                <ReelPlayer
                  uri={video.url}
                  active={activeReelId === item._id}
                  style={styles.reelVideo}
                />

                <View style={styles.reelOverlay}>
                  <TouchableOpacity
                    style={styles.reelAuthor}
                    onPress={() => router.push(`/user/${item.userId}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.authorName || 'this user'}'s profile`}
                  >
                    <Avatar
                      name={item.authorName}
                      uri={item.authorAvatarUrl}
                      size={42}
                    />

                    <Text style={styles.reelAuthorText}>
                      {item.authorName || 'Unknown user'}
                    </Text>
                  </TouchableOpacity>

                  {item.content ? (
                    <Text style={styles.reelCaption} numberOfLines={4}>
                      {item.content}
                    </Text>
                  ) : null}

                  <View style={styles.reelActions}>
                    <TouchableOpacity
                      style={styles.reelAction}
                      onPress={() => handleLike(item._id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.liked ? 'Unlike' : 'Like'} Reel`}
                    >
                      <Text style={{ fontSize: 28 }}>
                        {item.liked ? '❤️' : '🤍'}
                      </Text>
                      <Text style={styles.reelActionText}>
                        {item.likes}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reelAction}
                      onPress={() => router.push(`/post/${item._id}` as any)}
                      accessibilityRole="button"
                      accessibilityLabel="Open Reel comments"
                    >
                      <Text style={{ fontSize: 28 }}>💬</Text>
                      <Text style={styles.reelActionText}>
                        {item.commentsCount}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reelAction}
                      onPress={() => handleReshare(item._id)}
                      accessibilityRole="button"
                      accessibilityLabel="Reshare Reel"
                    >
                      <FeedActionIcon
                        type="reshare"
                        color={colors.white}
                        size={25}
                      />
                      <Text style={styles.reelActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
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
