import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

type PostMedia = { url: string; type: 'image' | 'video'; publicId?: string };
type ProfilePost = {
  _id: string;
  userId: string;
  title?: string;
  content?: string;
  media?: PostMedia[];
  createdAt?: string;
  likes?: number;
  commentsCount?: number;
  liked?: boolean;
};

type MenuItem = { label: string; route: string };

const extractArray = (res: any): any[] =>
  Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data?.users) ? res.data.users : [];

export default function ProfileScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'reshared' | 'liked'>('posts');
  const [reshared, setReshared] = useState<ProfilePost[]>([]);
  const [liked, setLiked] = useState<ProfilePost[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tabError, setTabError] = useState('');

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { height: 48, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    menuLine: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.text,
      marginVertical: 2.5,
    },
    cover: { width: '100%', height: 128, backgroundColor: colors.surface },
    coverImage: { width: '100%', height: '100%' },
    profile: { alignItems: 'center', marginTop: -40, paddingHorizontal: Spacing.md },
    avatar: { width: 82, height: 82, borderRadius: Radius.full, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: '100%', height: '100%', borderRadius: Radius.full },
    avatarText: { color: colors.white, fontSize: 30, fontWeight: '800' },
    name: { marginTop: 8, color: colors.text, fontSize: 20, fontWeight: '800' },
    username: { marginTop: 1, color: colors.textMuted, fontSize: 13 },
    bio: { marginTop: 6, color: colors.text, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 340 },
    stats: { flexDirection: 'row', width: '100%', justifyContent: 'center', marginTop: 14, marginBottom: 10 },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
    statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    edit: { width: '76%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: 24, marginBottom: 10, alignItems: 'center' },
    editText: { color: colors.text, fontWeight: '800', fontSize: 13 },
    tabs: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary, marginBottom: -1 },
    tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    tabTextActive: { color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tile: { width: '33.3333%', aspectRatio: 1, padding: 0.75 },
    tileInner: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    tileImage: { width: '100%', height: '100%' },
    tileText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', padding: 6 },
    tileType: { color: colors.textMuted, fontSize: 9, marginBottom: 2, textTransform: 'uppercase' },
    center: { alignItems: 'center', padding: Spacing.xl },
    muted: { color: colors.textMuted, textAlign: 'center' },
    error: { color: colors.danger, textAlign: 'center', padding: Spacing.md },
    menuPage: {
      flex: 1,
    },
    menuPageHeader: {
      height: 56,
      paddingHorizontal: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuBackButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuBackText: {
      color: colors.text,
      fontSize: 34,
      fontWeight: '300',
      lineHeight: 38,
    },
    menuPageTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    menuHeaderSpacer: {
      width: 40,
    },
    menuPageContent: {
      paddingBottom: Spacing.xl,
    },
    menuPageItem: {
      minHeight: 58,
      paddingHorizontal: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    menuPageItemText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    menuPageChevron: {
      color: colors.textMuted,
      fontSize: 25,
      fontWeight: '300',
    },
  }), [colors]);

  const loadBasic = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try {
      const [meRes, postsRes, followersRes, followingRes] = await Promise.all([
        api.get('/auth/me'),
        api.get(`/posts/user/${user.id}`),
        api.get(`/follow/${user.id}/followers`),
        api.get(`/follow/${user.id}/following`),
      ]);
      const me = meRes.data?.user;
      if (me) setUser({ ...user, ...me });
      setPosts(extractArray(postsRes));
      setFollowers(extractArray(followersRes));
      setFollowing(extractArray(followingRes));
    } catch {
      // Keep already-loaded local state if a refresh fails.
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setUser, user]);

  const loadSecondary = useCallback(async (tab: 'reshared' | 'liked') => {
    setTabError('');
    setTabLoading(true);
    try {
      const endpoint = tab === 'reshared' ? `/posts/user/${user?.id}/reshares` : '/posts/liked';
      const res = await api.get(endpoint);
      const items = extractArray(res) as ProfilePost[];
      if (tab === 'reshared') setReshared(items);
      else setLiked(items);
    } catch (err: any) {
      setTabError(err?.response?.data?.message || `Could not load ${tab} right now.`);
    } finally {
      setTabLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadBasic(); }, [loadBasic]);
  useFocusEffect(useCallback(() => { loadBasic(true); }, [loadBasic]));

  useEffect(() => {
    if (activeTab !== 'posts') loadSecondary(activeTab);
  }, [activeTab, loadSecondary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBasic(true);
    if (activeTab !== 'posts') await loadSecondary(activeTab);
    setRefreshing(false);
  };

  const menuItems: MenuItem[] = [
    { label: 'Following & Followers', route: '/profile/following' },
    { label: 'Find People', route: '/people' },
    { label: `Username${user?.username ? ` (@${user.username})` : ''}`, route: '/people/username' },
    { label: 'Achievements & Portfolio', route: '/profile/achievements' },
    { label: 'Hidden Posts', route: '/profile/hidden' },
    { label: 'Settings', route: '/settings' },
  ];

  const items = activeTab === 'posts' ? posts : activeTab === 'reshared' ? reshared : liked;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Open profile menu">
            <View accessible accessibilityRole="image" accessibilityLabel="Profile menu">
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.cover}>{user?.coverUrl ? <Image source={{ uri: user.coverUrl }} style={styles.coverImage} resizeMode="cover" /> : null}</View>
        <View style={styles.profile}>
          <View style={styles.avatar}>{user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>}</View>
          <Text style={styles.name}>{user?.name || 'Unknown'}</Text>
          {user?.username ? <Text style={styles.username}>@{user.username}</Text> : null}
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{posts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <TouchableOpacity style={styles.stat} onPress={() => router.push('/profile/following' as any)}><Text style={styles.statValue}>{followers.length}</Text><Text style={styles.statLabel}>Followers</Text></TouchableOpacity>
            <TouchableOpacity style={styles.stat} onPress={() => router.push('/profile/following' as any)}><Text style={styles.statValue}>{following.length}</Text><Text style={styles.statLabel}>Following</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.edit} onPress={() => router.push('/profile/edit')} accessibilityRole="button"><Text style={styles.editText}>Edit Profile</Text></TouchableOpacity>
        </View>
        <View style={styles.tabs}>
          {(['posts', 'reshared', 'liked'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'posts' ? 'Posts' : tab === 'reshared' ? 'Reshared' : 'Liked'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading || tabLoading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : tabError ? <Text style={styles.error}>{tabError}</Text> : items.length === 0 ? <View style={styles.center}><Text style={styles.muted}>{activeTab === 'posts' ? 'No posts yet.' : activeTab === 'reshared' ? 'No reshares yet.' : 'No liked posts yet.'}</Text></View> : (
          <View style={styles.grid}>
            {items.map((post) => {
              const image = post.media?.find((m) => m.type === 'image')?.url;
              return <TouchableOpacity key={post._id} style={styles.tile} onPress={() => router.push(`/post/${post._id}` as any)} accessibilityRole="button"><View style={styles.tileInner}>{image ? <Image source={{ uri: image }} style={styles.tileImage} resizeMode="cover" /> : <><Text style={styles.tileType}>{post.title ? 'Post' : 'Text'}</Text><Text numberOfLines={5} style={styles.tileText}>{post.title || post.content || 'Post'}</Text></>}</View></TouchableOpacity>;
            })}
          </View>
        )}
      </ScrollView>
      <Modal
  visible={menuOpen}
  animationType="slide"
  onRequestClose={() => setMenuOpen(false)}
>
  <View style={[styles.menuPage, { backgroundColor: colors.background }]}>
    <View style={styles.menuPageHeader}>
      <TouchableOpacity
        style={styles.menuBackButton}
        onPress={() => setMenuOpen(false)}
        accessibilityRole="button"
        accessibilityLabel="Close profile menu"
      >
        <Text style={styles.menuBackText}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.menuPageTitle}>Profile</Text>

      <View style={styles.menuHeaderSpacer} />
    </View>

    <ScrollView
      contentContainerStyle={styles.menuPageContent}
      showsVerticalScrollIndicator={false}
    >
      {menuItems.map((item) =>
        <TouchableOpacity
          key={item.label}
          style={styles.menuPageItem}
          onPress={() => {
            setMenuOpen(false);
            router.push(item.route as any);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.menuPageItemText}>{item.label}</Text>
          <Text style={styles.menuPageChevron}>›</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  </View>
</Modal>
    </View>
  );
}
