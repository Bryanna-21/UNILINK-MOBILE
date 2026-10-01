import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL, NEW TONIGHT. This screen did not exist before — there
// was no way to view anyone's profile except your own. Built to
// support "click a name on a post/comment to see their profile and
// message them."
//
// Calls, all confirmed real: GET /profile/summary/:userId (name,
// role, avatarUrl, bio — expanded tonight from name/role only, same
// exposure tier as what's already public on every post),
// GET /profile/achievements/:userId (existed already, simply never
// had a mobile caller until now), GET/POST/DELETE /follow/:userId and
// GET /follow/:userId/status (all new tonight — the Follow model,
// controller, and routes did not exist anywhere before this session).
//
// Deliberately minimal: no followers/following COUNT is shown, since
// that would need a second round trip (getFollowers/getFollowing
// return full user lists, not just a count) and wasn't asked for —
// only follow/unfollow and viewing the profile itself were.

interface UserSummary {
  _id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  bio?: string;
}

interface UserPost {
  _id: string;
  title: string;
  content: string;
  likes?: number;
  commentsCount?: number;
  createdAt: string;
}

interface Achievement {
  _id: string;
  title: string;
  description?: string;
  awardedAt: string;
}

export default function UserProfileScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [user, setUser] = useState<UserSummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowActionPending, setIsFollowActionPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        card: { alignItems: 'center', padding: Spacing.lg },
        avatar: {
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: Spacing.sm,
        },
        avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
        avatarText: { fontSize: 32, color: colors.white, fontWeight: '800' },
        name: { fontSize: 20, fontWeight: '800', color: colors.text },
        role: { fontSize: 13, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
        bio: { fontSize: 14, color: colors.text, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.lg },
        actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
        followButton: {
          paddingHorizontal: Spacing.lg,
          paddingVertical: 10,
          borderRadius: Radius.md,
          backgroundColor: colors.primary,
        },
        followingButton: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        followButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
        followingButtonText: { color: colors.text, fontWeight: '700', fontSize: 14 },
        messageButton: {
          paddingHorizontal: Spacing.lg,
          paddingVertical: 10,
          borderRadius: Radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        messageButtonText: { color: colors.text, fontWeight: '700', fontSize: 14 },
        section: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.md,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm },
        achievementRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
        achievementTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        emptyText: { fontSize: 13, color: colors.textMuted },
        postRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
        postTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        postSnippet: { fontSize: 13, color: colors.text, marginTop: 2 },
        postMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
        errorText: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: Spacing.xl },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [summaryRes, achievementsRes, statusRes, postsRes] = await Promise.all([
        api.get(`/profile/summary/${id}`),
        api.get(`/profile/achievements/${id}`),
        api.get(`/follow/${id}/status`),
        // Posts are secondary: a failure here must not blank the whole profile.
        api.get(`/posts/user/${id}`).catch(() => null),
      ]);
      setUser(summaryRes.data?.data ?? null);
      setAchievements(achievementsRes.data?.data ?? []);
      setIsFollowing(statusRes.data?.data?.isFollowing ?? false);
      setPosts(postsRes?.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load this profile.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleFollow = async () => {
    if (!id || isFollowActionPending) return;
    setIsFollowActionPending(true);
    try {
      if (isFollowing) {
        await api.delete(`/follow/${id}`);
        setIsFollowing(false);
      } else {
        await api.post(`/follow/${id}`);
        setIsFollowing(true);
      }
    } catch {
      // Deliberately silent on failure — the button's state simply
      // doesn't change, which is an honest reflection of "the action
      // didn't take effect," without a jarring alert for what's
      // usually a transient network issue on a low-stakes action.
    } finally {
      setIsFollowActionPending(false);
    }
  };

  // Starts (or reopens) a direct conversation with THIS user via
  // POST /messages/start { otherUserId }. The backend validates the
  // target (same university, not deleted, not yourself).
  const handleMessage = async () => {
    if (!id || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const res = await api.post('/messages/start', { otherUserId: id });
      const conversationId = res.data?.data?._id;
      if (conversationId) router.push(`/chat/${conversationId}` as any);
    } catch {
      // Fall back to the search/picker flow rather than dead-ending.
      router.push('/messages/new' as any);
    } finally {
      setIsStartingChat(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (loadError || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{loadError || 'Profile not found.'}</Text>
      </View>
    );
  }

  const isOwnProfile = String(currentUserId) === String(user._id);

  return (
    <ScrollView style={styles.container}>
      <StatusBanner status="real" note="Profile, posts, achievements, follow status and direct messaging are all live." />

      <View style={styles.card}>
        <View style={styles.avatar}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{user.name?.charAt(0)?.toUpperCase() || '?'}</Text>
          )}
        </View>
        <Text style={styles.name} accessibilityRole="header">
          {user.name}
        </Text>
        <Text style={styles.role}>{user.role}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {!isOwnProfile ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleToggleFollow}
              disabled={isFollowActionPending}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? `Unfollow ${user.name}` : `Follow ${user.name}`}
              accessibilityState={{ busy: isFollowActionPending }}
            >
              {isFollowActionPending ? (
                <ActivityIndicator size="small" color={isFollowing ? colors.text : colors.white} />
              ) : (
                <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleMessage}
              disabled={isStartingChat}
              accessibilityRole="button"
              accessibilityLabel={`Message ${user.name}`}
            >
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Achievements
        </Text>
        {achievements.length === 0 ? (
          <Text style={styles.emptyText}>No achievements yet.</Text>
        ) : (
          achievements.map((a) => (
            <View key={a._id} style={styles.achievementRow}>
              <Text style={styles.achievementTitle}>{a.title}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, { marginBottom: Spacing.xl }]}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Posts
        </Text>
        {posts.length === 0 ? (
          <Text style={styles.emptyText}>No posts yet.</Text>
        ) : (
          posts.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={styles.postRow}
              onPress={() => router.push(`/post/${p._id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Open post: ${p.title}`}
            >
              <Text style={styles.postTitle}>{p.title}</Text>
              <Text style={styles.postSnippet} numberOfLines={2}>
                {p.content}
              </Text>
              <Text style={styles.postMeta}>
                {new Date(p.createdAt).toLocaleDateString()} · {p.likes ?? 0} likes · {p.commentsCount ?? 0} comments
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
