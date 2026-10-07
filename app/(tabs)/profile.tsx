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
    header: { height: 54, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    menuLine: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.text,
      marginVertical: 2.5,
    },
    cover: { width: '100%', height: 145, backgroundColor: colors.surface },
    coverImage: { width: '100%', height: '100%' },
    profile: { alignItems: 'center', marginTop: -42, paddingHorizontal: Spacing.lg },
    avatar: { width: 84, height: 84, borderRadius: Radius.full, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: '100%', height: '100%', borderRadius: Radius.full },
    avatarText: { color: colors.white, fontSize: 32, fontWeight: '800' },
    name: { marginTop: Spacing.sm, color: colors.text, fontSize: 21, fontWeight: '800' },
    username: { marginTop: 2, color: colors.textMuted, fontSize: 14 },
    bio: { marginTop: Spacing.sm, color: colors.text, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    stats: { flexDirection: 'row', width: '100%', justifyContent: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
    stat: { minWidth: 90, alignItems: 'center' },
    statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
    statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    edit: { borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 34, marginBottom: Spacing.lg },
    editText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 13 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tile: { width: '33.3333%', aspectRatio: 1, padding: 1 },
    tileInner: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    tileImage: { width: '100%', height: '100%' },
    tileText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', padding: 6 },
    tileType: { color: colors.textMuted, fontSize: 9, marginBottom: 2, textTransform: 'uppercase' },
    center: { alignItems: 'center', padding: Spacing.xl },
    muted: { color: colors.textMuted, textAlign: 'center' },
    error: { color: colors.danger, textAlign: 'center', padding: Spacing.md },
    menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
    menu: { position: 'absolute', top: 58, right: Spacing.md, width: 230, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: Spacing.xs },
    menuItem: { paddingHorizontal: Spacing.md, paddingVertical: 14 },
    menuItemText: { color: colors.text, fontSize: 14, fontWeight: '600' },
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
    { label: 'Edit Profile', route: '/profile/edit' },
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
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            {menuItems.map((item) => <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => { setMenuOpen(false); router.push(item.route as any); }}><Text style={styles.menuItemText}>{item.label}</Text></TouchableOpacity>)}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
