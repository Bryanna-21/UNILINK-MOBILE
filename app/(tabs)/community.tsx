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
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — calls GET /api/posts/feed, POST /api/posts/create,
// and POST /api/posts/like/:id on the live backend. This is the
// "Community" tab's post-feed portion only; Clubs/Projects/Study
// Groups/Polls sections from the spec are separate, unbuilt features.

interface Post {
  _id: string;
  userId: string;
  content: string;
  mediaUrl?: string;
  likes: number;
  commentsCount: number;
  score: number;
  createdAt: string;
}

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
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

  const handlePost = async () => {
    if (!newPost.trim() || isPosting) return;
    setIsPosting(true);
    try {
      await api.post('/posts/create', { content: newPost.trim() });
      setNewPost('');
      loadFeed();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create the post.');
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

      <StatusBanner status="real" note="Feed and posting use the live backend." />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Share something with your campus..."
          placeholderTextColor={Colors.textMuted}
          value={newPost}
          onChangeText={setNewPost}
          multiline
        />
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
  postButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
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
