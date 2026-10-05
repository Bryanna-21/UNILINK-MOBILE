import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL, NEW. The Following / Followers tabs of your own profile. Uses the existing
// GET /follow/:me/following and /followers, DELETE /follow/:id to unfollow, and
// POST /messages/start to open a chat.

interface Person {
  _id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string;
}

type Tab = 'Following' | 'Followers';

const extract = (res: any): Person[] => res?.data?.data ?? res?.data?.users ?? [];

export default function FollowingScreen() {
  const colors = useColors();
  const me = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<Tab>('Following');
  const [following, setFollowing] = useState<Person[]>([]);
  const [followers, setFollowers] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.xs },
        tab: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 8,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
        tabTextActive: { color: colors.white },
        findButton: {
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          paddingVertical: 12,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
        },
        findButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          gap: Spacing.sm,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarImage: { width: '100%', height: '100%', borderRadius: Radius.full },
        avatarText: { color: colors.white, fontWeight: '700' },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        handle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
        actions: { flexDirection: 'row', gap: Spacing.xs },
        smallButton: {
          paddingHorizontal: Spacing.sm,
          paddingVertical: 7,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        smallButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
        smallText: { fontSize: 12, fontWeight: '700', color: colors.text },
        smallTextPrimary: { color: colors.white },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const [a, b] = await Promise.all([api.get('/follow/' + me + '/following'), api.get('/follow/' + me + '/followers')]);
      setFollowing(extract(a));
      setFollowers(extract(b));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your people.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [me]);

  // Re-fetch on focus so a follow or unfollow made elsewhere shows up here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unfollow = async (p: Person) => {
    setFollowing((prev) => prev.filter((x) => x._id !== p._id));
    try {
      await api.delete('/follow/' + p._id);
    } catch {
      load(); // put the list back to whatever the server says
    }
  };

  const message = async (p: Person) => {
    if (startingId) return;
    setStartingId(p._id);
    try {
      const res = await api.post('/messages/start', { otherUserId: p._id });
      const conversationId = res.data?.data?._id;
      if (conversationId) router.push(('/chat/' + conversationId) as any);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not start the conversation.');
    } finally {
      setStartingId(null);
    }
  };

  const data = tab === 'Following' ? following : followers;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'Following', label: 'Following (' + following.length + ')' },
    { key: 'Followers', label: 'Followers (' + followers.length + ')' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Following', headerShown: true }} />

      <View style={styles.tabRow} accessibilityRole="tablist">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            accessibilityLabel={t.label}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.findButton}
        onPress={() => router.push('/people' as any)}
        accessibilityRole="button"
        accessibilityLabel="Find people"
      >
        <Text style={styles.findButtonText}>Find people</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              {tab === 'Following' ? "You're not following anyone yet." : 'No followers yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(('/user/' + item._id) as any)}
              accessibilityRole="button"
              accessibilityLabel={'Open profile of ' + item.name}
            >
              <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.username ? <Text style={styles.handle}>@{item.username}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.smallButton, styles.smallButtonPrimary]}
                  onPress={() => message(item)}
                  disabled={startingId === item._id}
                  accessibilityRole="button"
                  accessibilityLabel={'Message ' + item.name}
                >
                  <Text style={[styles.smallText, styles.smallTextPrimary]}>Message</Text>
                </TouchableOpacity>
                {tab === 'Following' ? (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => unfollow(item)}
                    accessibilityRole="button"
                    accessibilityLabel={'Unfollow ' + item.name}
                  >
                    <Text style={styles.smallText}>Unfollow</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
