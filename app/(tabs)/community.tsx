import { useState, useCallback } from 'react';
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
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — calls GET /api/posts/feed, POST /api/posts/create,
// and POST /api/posts/like/:id on the live backend. This is the
// "Community" tab's post-feed portion only; Clubs/Projects/Study
// Groups/Polls sections from the spec are separate, unbuilt features.
//
// Media upload uses a dedicated axios call (not the shared `api`
// client) deliberately: the shared client's cold-start interceptor
// retries a failed request by replaying the same config object, which
// is unsafe for a FormData body containing a file — React Native's
// FormData file entries aren't reliably re-readable on a second send.
// Media uploads instead use one generous timeout up front and no
// automatic retry, matching the same cold-start reality without the
// replay risk.

const MAX_MEDIA_ITEMS = 4;
const MEDIA_UPLOAD_TIMEOUT_MS = 90000; // generous single attempt, no retry

interface PostMedia {
  url: string;
  type: 'image' | 'video';
  publicId: string;
}

interface Post {
  _id: string;
  userId: string;
  content: string;
  media?: PostMedia[];
  likes: number;
  commentsCount: number;
  score: number;
  createdAt: string;
}

// Local-only shape for an asset the user has picked but not yet
// uploaded — separate from PostMedia, which describes an already
// uploaded, Cloudinary-hosted attachment.
interface PendingAsset {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
}

function InlineVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    // Deliberately not calling p.play() here — no autoplay. Video
    // starts paused; the visible native controls let the user start
    // it themselves. Scroll-triggered autoplay is a real feature with
    // its own cost (bandwidth, viewport tracking) and was intentionally
    // left out of this pass.
  });

  return (
    <VideoView
      player={player}
      style={styles.media}
      nativeControls
      allowsFullscreen
    />
  );
}

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // No attachments — plain JSON body, same as before, still
        // goes through the shared `api` client and its retry logic
        // since there's no file re-read risk here.
        await api.post('/posts/create', { content: newPost.trim() });
      } else {
        const token = await SecureStore.getItemAsync('unilink_token');
        const formData = new FormData();
        formData.append('content', newPost.trim());
        pendingAssets.forEach((asset) => {
          // React Native's FormData accepts this { uri, name, type }
          // shape directly as a file entry.
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

  const handleLike = async (postId: string) => {
    // Optimistic update so the tap feels instant; reconciled on next feed load.
    setPosts((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, likes: p.likes + 1 } : p))
    );
    try {
      await api.post(`/posts/like/${postId}`);
    } catch {
      loadFeed();
    }
  };

  const renderPostMedia = (media?: PostMedia[]) => {
    if (!media || media.length === 0) return null;
    const first = media[0];
    const extraCount = media.length - 1;

    return (
      <View style={styles.mediaWrap}>
        {first.type === 'video' ? (
          <InlineVideo uri={first.url} />
        ) : (
          <Image source={{ uri: first.url }} style={styles.media} resizeMode="cover" />
        )}
        {extraCount > 0 && (
          <View style={styles.moreBadge}>
            <Text style={styles.moreBadgeText}>+{extraCount} more</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/community-hub' as any)}>
            <Text style={styles.headerAction}>👥 Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/messages')}>
            <Text style={styles.headerAction}>💬 Messages</Text>
          </TouchableOpacity>
        </View>
      </View>

      <StatusBanner status="real" note="Feed and posting use the live backend, including photo and video attachments." />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Share something with your campus..."
          placeholderTextColor={Colors.textMuted}
          value={newPost}
          onChangeText={setNewPost}
          multiline
        />

        {pendingAssets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
            {pendingAssets.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={styles.pendingThumbWrap}>
                {asset.type === 'video' ? (
                  <View style={[styles.pendingThumb, styles.pendingVideoPlaceholder]}>
                    <Text style={styles.pendingVideoIcon}>▶</Text>
                  </View>
                ) : (
                  <Image source={{ uri: asset.uri }} style={styles.pendingThumb} />
                )}
                <TouchableOpacity
                  style={styles.removeThumbButton}
                  onPress={() => handleRemovePendingAsset(index)}
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
          >
            <Text style={styles.attachButtonText}>📎 Add photo/video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postButton, (!newPost.trim() || isPosting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!newPost.trim() || isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No posts yet. Be the first to share something.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <Text style={styles.postContent}>{item.content}</Text>
              {renderPostMedia(item.media)}
              <View style={styles.postFooter}>
                <TouchableOpacity onPress={() => handleLike(item._id)}>
                  <Text style={styles.likeButton}>❤️ {item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/post/${item._id}` as any)}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  headerAction: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  composer: {
    backgroundColor: Colors.white,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  composerInput: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  pendingRow: {
    marginTop: Spacing.sm,
  },
  pendingThumbWrap: {
    marginRight: Spacing.sm,
    position: 'relative',
  },
  pendingThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  pendingVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingVideoIcon: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  removeThumbButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.danger,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumbText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  attachButton: {
    paddingVertical: Spacing.xs,
  },
  attachButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: Colors.danger,
    textAlign: 'center',
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: Spacing.xl,
  },
  postCard: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postContent: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  mediaWrap: {
    marginTop: Spacing.sm,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: 220,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  moreBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  moreBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  postFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  likeButton: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  commentCount: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});