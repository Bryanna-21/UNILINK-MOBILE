import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import KeyboardSafe from '../../src/components/KeyboardSafe';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — GET /api/admin/roles/users and PATCH /api/admin/roles/:id.
//
// Change someone's role directly:
//   admin       student -> lecturer, lecturer -> student, inside their own university
//   superadmin  the same, plus making an admin (or turning an admin back)
// The server enforces all of it; this screen only offers what the caller is allowed to do, and
// shows the server's message when it says no. The person is signed out and signs in again.

type Role = 'student' | 'lecturer' | 'admin';

interface Row {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
}

const LABEL: Record<Role, string> = { student: 'Make student', lecturer: 'Make lecturer', admin: 'Make admin' };

// What each viewer may offer for a person in each role. Mirrors utils/roleChange.rules.js.
function optionsFor(viewerRole: string | undefined, targetRole: Role): Role[] {
  if (viewerRole === 'superadmin') return (['student', 'lecturer', 'admin'] as Role[]).filter((r) => r !== targetRole);
  if (viewerRole === 'admin') {
    if (targetRole === 'student') return ['lecturer'];
    if (targetRole === 'lecturer') return ['student'];
  }
  return [];
}

export default function AdminRolesScreen() {
  const colors = useColors();
  const styles = useStyles(colors);
  // The app types the role as student | lecturer | admin, but the server also sends "superadmin".
  const viewerRole = useAuthStore((s) => s.user?.role) as string | undefined;

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setError('Type at least 2 letters of a name, email or username.');
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const res = await api.get('/admin/roles/users', { params: { q } });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: any) {
      setRows(null);
      setError(err?.response?.data?.message || 'Could not search. Try again.');
    } finally {
      setSearching(false);
    }
  };

  const apply = async (row: Row, to: Role, platformWide = false) => {
    setBusyId(row.id);
    try {
      await api.patch(`/admin/roles/${row.id}`, platformWide ? { role: to, platformWide: true } : { role: to });
      setRows((list) => (list ? list.map((r) => (r.id === row.id ? { ...r, role: to } : r)) : list));
      Alert.alert('Role changed', `${row.name || 'The user'} is now a ${to}. They are signed out and must sign in again.`);
    } catch (err: any) {
      Alert.alert('Could not change the role', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  const choose = (row: Row, to: Role) => {
    if (to === 'admin') {
      // An admin sees one university by default. Platform-wide is a separate, deliberate choice.
      Alert.alert(`Make ${row.name || 'this user'} an admin?`, 'Choose what they can manage. They are signed out and must sign in again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Their university only', onPress: () => apply(row, 'admin', false) },
        { text: 'Every university', style: 'destructive', onPress: () => apply(row, 'admin', true) },
      ]);
      return;
    }
    Alert.alert(`Make ${row.name || 'this user'} a ${to}?`, 'They are signed out and must sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => apply(row, to) },
    ]);
  };

  return (
    <KeyboardSafe>
      <View style={styles.container}>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Text style={styles.title} accessibilityRole="header">
                Make Lecturer{viewerRole === 'superadmin' ? ' or Admin' : ''}
              </Text>
              <StatusBanner status="real" note="Role changes are saved to the real backend." />
              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Name, email or username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={search}
                  maxLength={60}
                  style={styles.searchInput}
                  accessibilityLabel="Search users"
                />
                <TouchableOpacity onPress={search} disabled={searching} style={styles.searchButton} accessibilityRole="button" accessibilityLabel="Search">
                  {searching ? <ActivityIndicator color={colors.white} /> : <Text style={styles.searchButtonText}>Search</Text>}
                </TouchableOpacity>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {rows === null && !error ? <Text style={styles.hint}>Search for the person first.</Text> : null}
            </View>
          }
          ListEmptyComponent={rows !== null ? <Text style={styles.hint}>No matching people in your scope.</Text> : null}
          renderItem={({ item }) => {
            const options = optionsFor(viewerRole, item.role);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
                    <Text style={styles.meta}>
                      {item.email}
                      {item.username ? ` · @${item.username}` : ''}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.role}</Text>
                  </View>
                </View>
                {options.length > 0 && (
                  <View style={styles.actions}>
                    {options.map((to) => (
                      <TouchableOpacity
                        key={to}
                        disabled={busyId === item.id}
                        onPress={() => choose(item, to)}
                        style={[styles.action, busyId === item.id && { opacity: 0.5 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${LABEL[to]}: ${item.name}`}
                      >
                        <Text style={styles.actionText}>{LABEL[to]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
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
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
        searchInput: {
          flex: 1,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
        },
        searchButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center', minWidth: 84, alignItems: 'center' },
        searchButtonText: { color: colors.white, fontWeight: '800' },
        error: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        hint: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.lg },
        card: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.sm },
        cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        badge: { backgroundColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        badgeText: { fontSize: 11, fontWeight: '700', color: colors.white, textTransform: 'capitalize' },
        actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
        action: { borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
        actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
      }),
    [colors]
  );
}
