import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL, NEW. Find people by username (GET /people/search) and see suggestions
// (GET /people/suggestions). "Follow" uses the existing POST/DELETE /follow/:userId.
// Search needs 3+ characters and only returns people at your own university.

interface Person {
  _id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string;
  isFollowing?: boolean;
  reason?: string;
}

export default function FindPeopleScreen() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Local follow state per person, layered over what the server last told us.
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const term = query.trim().replace(/^@+/, '');
  const isSearchMode = term.length >= 3;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        searchInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.text,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.md,
        },
        hint: { fontSize: 12, color: colors.textMuted, marginHorizontal: Spacing.md, marginTop: Spacing.xs },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: Spacing.xs },
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
        reason: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        followButton: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 8,
          borderRadius: Radius.md,
          backgroundColor: colors.primary,
          minWidth: 84,
          alignItems: 'center',
        },
        followingButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        followText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        followingText: { color: colors.text, fontWeight: '700', fontSize: 13 },
      }),
    [colors]
  );

  useEffect(() => {
    let cancelled = false;
    api
      .get('/people/suggestions')
      .then((res) => {
        if (!cancelled) setSuggestions(res.data?.data ?? []);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Could not load suggestions.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced username search. `cancelled` drops out-of-order replies, so typing "bry" then
  // "brya" can never let the slower "bry" answer overwrite the "brya" results.
  useEffect(() => {
    if (term.length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/people/search', { params: { q: term } });
        if (!cancelled) {
          setResults(res.data?.data ?? []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || 'Search failed.');
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const isFollowing = (p: Person) => followed[p._id] ?? !!p.isFollowing;

  const toggleFollow = async (p: Person) => {
    if (pending[p._id]) return;
    const was = isFollowing(p);
    setPending((prev) => ({ ...prev, [p._id]: true }));
    setFollowed((prev) => ({ ...prev, [p._id]: !was }));
    try {
      if (was) await api.delete('/follow/' + p._id);
      else await api.post('/follow/' + p._id);
    } catch (err: any) {
      // 409 = the server already had the follow; the optimistic state is correct.
      if (!(!was && err?.response?.status === 409)) {
        setFollowed((prev) => ({ ...prev, [p._id]: was }));
      }
    } finally {
      setPending((prev) => ({ ...prev, [p._id]: false }));
    }
  };

  const renderPerson = ({ item }: { item: Person }) => {
    const following = isFollowing(item);
    const busy = !!pending[item._id];
    return (
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
          {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.followButton, following && styles.followingButton]}
          onPress={() => toggleFollow(item)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={(following ? 'Unfollow ' : 'Follow ') + item.name}
          accessibilityState={{ busy }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={following ? colors.text : colors.white} />
          ) : (
            <Text style={following ? styles.followingText : styles.followText}>{following ? 'Following' : 'Follow'}</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const data = isSearchMode ? results : suggestions;
  const showSpinner = isSearchMode ? isSearching && results.length === 0 : isLoadingSuggestions;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Find people', headerShown: true }} />

      <TextInput
        style={styles.searchInput}
        placeholder="Search by username"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search people by username"
      />
      {query.trim().length > 0 && !isSearchMode ? (
        <Text style={styles.hint}>Type at least 3 characters.</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showSpinner ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListHeaderComponent={
            !isSearchMode && suggestions.length > 0 ? (
              <Text style={styles.sectionLabel} accessibilityRole="header">
                Suggested for you
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              {isSearchMode
                ? 'No one at your university has a username starting with "' + term + '".'
                : 'No suggestions yet. Try searching for a classmate\'s username.'}
            </Text>
          }
          renderItem={renderPerson}
        />
      )}
    </View>
  );
}
