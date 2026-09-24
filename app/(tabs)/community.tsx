import { useState, useCallback, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

const MAX_MEDIA_ITEMS = 4;
const MEDIA_UPLOAD_TIMEOUT_MS = 90000;

interface PostMedia {
  url: string;
  type: 'image' | 'video';
  publicId: string;
}

interface Post {
  _id: string;
  userId: string;
  authorName?: string;
  content: string;
  media?: PostMedia[];
  likes: number;
  liked?: boolean;
  commentsCount: number;
  score: number;
  createdAt: string;
}

interface PendingAsset {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
}

function InlineVideo({ uri }: { uri: string }) {
  const colors = useColors();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  const mediaStyle = useMemo(
    () => ({
      width: '100%' as const,
      height: 220,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    }),
    [colors]
  );

  return <VideoView player={player} style={mediaStyle} nativeControls fullscreenOptions={{ enable: true }} />;
}

export default function CommunityScreen() {
  const colors = useColors();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
        },
        headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
        headerAction: { fontSize: 13, fontWeight: '600', color: colors.primary },
        headerActions: { flexDirection: 'row', gap: Spacing.md },
        composer: {
          backgroundColor: colors.surface,
          margin: Spacing.md,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        composerInput: { fontSize: 15, color: colors.text, minHeight: 44 },
        pendingRow: { marginTop: Spacing.sm },
        pendingThumbWrap: { marginRight: Spacing.sm, position: 'relative' },
        pendingThumb: {
          width: 64,
          height: 64,
          borderRadius: Radius.sm,
          backgroundColor: colors.border,
        },
        pendingVideoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
        pendingVideoIcon: { fontSize: 20, color: colors.textMuted },
        removeThumbButton: {
          position: 'absolute',
          top: -6,
          right: -6,
          backgroundColor: colors.danger,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeThumbText: { color: colors.white, fontSize: 11, fontWeight: '700' },
        composerFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: Spacing.sm,
        },
        attachButton: { paddingVertical: Spacing.xs },
        attachButtonText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
        postButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          alignItems: 'center',
        },
        postButtonDisabled: { opacity: 0.5 },
        postButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl },
        postCard: {
          backgroundColor: colors.surface,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        postAuthor: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
        postContent: { fontSize: 15, color: colors.text, lineHeight: 21 },
        mediaWrap: { marginTop: Spacing.sm, position: 'relative' },
        media: { width: '100%', height: 220, borderRadius: Radius.sm, backgroundColor: colors.border },
        moreBadge: {
          position: 'absolute',
          bottom: Spacing.sm,
          right: Spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: Spacing.sm,
          paddingVertical: 4,
          borderRadius: Radius.sm,
        },
        moreBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
        postFooter: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
        likeButton: { color: colors.textMuted, fontSize: 13 },
        commentCount: { color: colors.textMuted, fontSize: 13 },
      }),
    [colors]
  );

  const loadFeed = async () => {
    try {
      const res = await api.get('/posts/feed');
      setPosts(res.data?.data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the feed.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeed();
  };

  const handlePickMedia = async () => {
    if (pendingAssets.length >= MAX_MEDIA_ITEMS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_MEDIA_ITEMS} items per post.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access your photos and videos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA_ITEMS - pendingAssets.length,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked: PendingAsset[] = result.assets.map((asset) => ({
      uri: asset.uri,
      type: asset.type === 'video' ? 'video' : 'image',
      fileName: asset.fileName || `upload-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    }));
    setPendingAssets((prev) => [...prev, ...picked].slice(0, MAX_MEDIA_ITEMS));
  };

  const handleRemovePendingAsset = (index: number) => {
    setPendingAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!newPost.trim() || isPosting) return;
    setIsPosting(true);
    setError(null);
    try {
      if (pendingAssets.length === 0) {
        await api.post('/posts/create', { content: newPost.trim() });
      } else {
        const token = await SecureStore.getItemAsync('unilink_token');
        const formData = new FormData();
        formData.append('content', newPost.trim());
        pendingAssets.forEach((asset) => {
          formData.append('media', {
            uri: asset.uri,
            name: asset.fileName,
            type: asset.mimeType,
          } as any);
        });
        await axios.post(`${api.defaults.baseURL}/posts/create`, formData, {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            'Content-Type': 'multipart/form-data',
          },
          timeout: MEDIA_UPLOAD_TIMEOUT_MS,
        });
      }
      setNewPost('');
      setPendingAssets([]);
      loadFeed();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        Alert.alert('Session expired', 'Please log in again.');
      } else {
        setError(err?.response?.data?.message || 'Could not create the post.');
      }
    } finally {
      setIsPosting(false);
    }
  };

  // Real toggle now, matching the backend fix: previously this always
  // incremented regardless of whether the post was already liked,
  // mirroring the exact bug that existed server-side (blind increment,
  // no per-user tracking, no way to unlike). The optimistic update
  // below flips both `liked` and the count in the direction implied by
  // the CURRENT state before the request, then reconciles with the
  // server's actual response — using the response as truth rather
  // than trusting the optimistic guess is what makes this safe even
  // if two rapid taps race each other.
  const handleLike = async (postId: string) => {
    const post = posts.find((p) => p._id === postId);
    const wasLiked = post?.liked ?? false;

    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? { ...p, liked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
          : p
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
      // Revert the optimistic update on failure rather than silently
      // refetching the whole feed — this action is small enough that
      // a targeted revert is cheap and doesn't lose scroll position
      // the way loadFeed() would.
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, liked: wasLiked, likes: post?.likes ?? p.likes } : p))
      );
    }
  };

  const renderPostMedia = (media?: PostMedia[]) => {
    if (!media || media.length === 0) return null;
    const first = media[0];
    const extraCount = media.length - 1;
    return (
      <View
        style={styles.mediaWrap}
        accessibilityLabel={
          first.type === 'video'
            ? 'Video attachment'
            : extraCount > 0
              ? `Photo, plus ${extraCount} more attachment${extraCount > 1 ? 's' : ''}`
              : 'Photo attachment'
        }
      >
        {first.type === 'video' ? (
          <InlineVideo uri={first.url} />
        ) : (
          <Image source={{ uri: first.url }} style={styles.media} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no" />
        )}
        {extraCount > 0 && (
          <View style={styles.moreBadge} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.moreBadgeText}>+{extraCount} more</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Community
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/community-hub' as any)}
            accessibilityRole="button"
            accessibilityLabel="Community Hub"
          >
            <Text style={styles.headerAction}>👥 Hub</Text>
          </TouchableOpacity>
        </View>
      </View>

      <StatusBanner status="real" note="Feed and posting use the live backend, including photo and video attachments." />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Share something with your campus..."
          placeholderTextColor={colors.textMuted}
          value={newPost}
          onChangeText={setNewPost}
          multiline
          accessibilityLabel="Write a post"
        />

        {pendingAssets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
            {pendingAssets.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={styles.pendingThumbWrap}
                accessibilityLabel={`Attachment ${index + 1}, ${asset.type}`}
              >
                {asset.type === 'video' ? (
                  <View
                    style={[styles.pendingThumb, styles.pendingVideoPlaceholder]}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    <Text style={styles.pendingVideoIcon}>▶</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: asset.uri }}
                    style={styles.pendingThumb}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                )}
                <TouchableOpacity
                  style={styles.removeThumbButton}
                  onPress={() => handleRemovePendingAsset(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove attachment ${index + 1}`}
                >
                  <Text style={styles.removeThumbText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.composerFooter}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickMedia}
            disabled={isPosting}
            accessibilityRole="button"
            accessibilityLabel="Add photo or video"
            accessibilityState={{ disabled: isPosting }}
          >
            <Text style={styles.attachButtonText}>📎 Add photo/video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postButton, (!newPost.trim() || isPosting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!newPost.trim() || isPosting}
            accessibilityRole="button"
            accessibilityLabel="Post"
            accessibilityState={{ disabled: !newPost.trim() || isPosting, busy: isPosting }}
          >
            {isPosting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.postButtonText}>Post</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              No posts yet. Be the first to share something.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <TouchableOpacity
                onPress={() => router.push(`/user/${item.userId}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.authorName || 'this user'}'s profile`}
              >
                <Text style={styles.postAuthor}>{item.authorName || 'Unknown user'}</Text>
              </TouchableOpacity>
              <Text style={styles.postContent}>{item.content}</Text>
              {renderPostMedia(item.media)}
              <View style={styles.postFooter}>
                <TouchableOpacity
                  onPress={() => handleLike(item._id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.liked ? 'Unlike' : 'Like'}, ${item.likes} ${item.likes === 1 ? 'like' : 'likes'}`}
                  accessibilityState={{ selected: !!item.liked }}
                >
                  <Text style={styles.likeButton}>{item.liked ? '❤️' : '🤍'} {item.likes}</Text>
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
    </View>
  );
}
