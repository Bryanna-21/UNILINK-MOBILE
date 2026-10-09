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
  Alert,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL. Lists the people you have blocked and lets you unblock them.
// Uses GET /people/blocks and DELETE /people/blocks/:userId, both already live
// on the backend. Blocking itself happens from a person's profile (user/[id]).

interface Person {
  _id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string;
}

const extract = (res: any): Person[] => res?.data?.data ?? res?.data?.users ?? [];

export default function BlockedUsersScreen() {
  const colors = useColors();
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: Spacing.md, gap: Spacing.sm },
        hint: { color: colors.textMuted, fontSize: 13, marginBottom: Spacing.sm },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, margin: Spacing.md },
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
        info: { flex: 1 },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        handle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
        button: {
          paddingHorizontal: Spacing.md,
          paddingVertical: 8,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        buttonText: { fontSize: 13, fontWeight: '700', color: colors.text },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get('/people/blocks');
      setPeople(extract(res));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load blocked users.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Re-fetch on focus so a block made from a profile shows up here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unblock = (p: Person) => {
    Alert.alert('Unblock ' + p.name + '?', 'They will be able to find you and message you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusyId(p._id);
          try {
            await api.delete('/people/blocks/' + p._id);
            setPeople((prev) => prev.filter((x) => x._id !== p._id));
          } catch (err: any) {
            Alert.alert('Could not unblock', err?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Person }) => (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.username ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{item.username}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => unblock(item)}
        disabled={busyId === item._id}
        accessibilityRole="button"
        accessibilityLabel={'Unblock ' + item.name}
        accessibilityState={{ disabled: busyId === item._id }}
      >
        {busyId === item._id ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.buttonText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Blocked users', headerShown: true }} />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              <Text style={styles.hint}>
                Blocked people cannot find you, follow you or message you. You can block someone from their profile.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          }
          ListEmptyComponent={
            error ? null : <Text style={styles.emptyText}>You have not blocked anyone.</Text>
          }
        />
      )}
    </View>
  );
}
