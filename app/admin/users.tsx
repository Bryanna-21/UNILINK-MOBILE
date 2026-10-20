import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — GET /api/admin/users, built last night, matching
// last night's web Admin/Users.js work exactly. Hard-capped at 200
// users server-side (no pagination UI on web either yet) — noted
// there as a known follow-up, still true here.

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  university: string | null;
  status: string;
  createdAt: string;
}

function capitalize(v?: string) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Unknown';
}

export default function AdminUsersScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'lecturer' | 'admin'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get('/admin/users', {
          params: { search: search || undefined, role: roleFilter === 'all' ? undefined : roleFilter },
        });
        setUsers(res.data?.data ?? []);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || 'Could not load users.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, roleFilter]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: DirectoryUser }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.userName}>{item.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{capitalize(item.role)}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{item.email}</Text>
      <Text style={styles.meta}>{item.university || 'No university'} · {capitalize(item.status)}</Text>
    </View>
  );

  return (
    <KeyboardSafe>
<View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Users
            </Text>
            <StatusBanner status="real" note="Every user, any role, from the live backend." />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}

            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load()}
            />

            <View style={styles.filterRow}>
              {(['all', 'student', 'lecturer', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterButton, roleFilter === r && styles.filterButtonActive]}
                  onPress={() => setRoleFilter(r)}
                >
                  <Text style={[styles.filterButtonText, roleFilter === r && styles.filterButtonTextActive]}>{capitalize(r === 'all' ? 'All' : r)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          ) : null
        }
      />
    </View>
</KeyboardSafe>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        listContent: { padding: Spacing.md, gap: Spacing.sm },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        searchInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
        filterButton: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        filterButtonText: { fontSize: 12, color: colors.text },
        filterButtonTextActive: { color: colors.white, fontWeight: '700' },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        userName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
        roleBadge: { backgroundColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        roleBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
      }),
    [colors]
  );
}
