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
  content: string;
  media?: PostMedia[];
  likes: number;
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

  return <VideoView player={player} style={mediaStyle} nativeControls allowsFullscreen />;
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

  const handleLike = async (postId: string) => {
    setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, likes: p.likes + 1 } : p)));
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
          placeholderTextColor={colors.textMuted}
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
                <TouchableOpacity style={styles.removeThumbButton} onPress={() => handleRemovePendingAsset(index)}>
                  <Text style={styles.removeThumbText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.composerFooter}>
          <TouchableOpacity style={styles.attachButton} onPress={handlePickMedia} disabled={isPosting}>
            <Text style={styles.attachButtonText}>📎 Add photo/video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postButton, (!newPost.trim() || isPosting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!newPost.trim() || isPosting}
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
          ListEmptyComponent={<Text style={styles.emptyText}>No posts yet. Be the first to share something.</Text>}
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
