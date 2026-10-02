import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — switch between accounts saved on this device, add
// another, or log out.
//
// How it works: each account's session token is kept in the device's
// secure storage (never in plain storage). Switching validates the
// saved token with the server FIRST and only then swaps, so a stale
// session can't leave the app half-switched. Logging out removes that
// account from the device entirely; "Add another account" signs out of
// the current one but keeps it saved.
//
// Navigation note: after any account change we pop to the root of the
// stack and replace it, so every screen remounts fresh. Without that,
// tabs that were already mounted would keep showing the previous
// account's in-memory data.

function resetTo(path: '/' | '/auth/login') {
  try {
    router.dismissAll();
  } catch {
    // Nothing to dismiss: fine.
  }
  router.replace(path);
}

export default function AccountsScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const accounts = useAuthStore((s) => s.accounts);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const addAccount = useAuthStore((s) => s.addAccount);
  const logout = useAuthStore((s) => s.logout);
  const removeSavedAccount = useAuthStore((s) => s.removeSavedAccount);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.lg, paddingTop: Spacing.xl },
        title: { fontSize: 24, fontWeight: '800', color: colors.text },
        hint: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: Spacing.lg },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
          gap: Spacing.md,
        },
        rowActive: { borderColor: colors.primary },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarText: { color: colors.white, fontWeight: '800', fontSize: 17 },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted },
        activeTag: { fontSize: 11, fontWeight: '800', color: colors.primary },
        removeText: { fontSize: 12, fontWeight: '700', color: colors.danger },
        addButton: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: Spacing.md,
        },
        addText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
        logoutButton: {
          backgroundColor: colors.danger,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: Spacing.lg,
        },
        logoutText: { color: colors.white, fontWeight: '700', fontSize: 16 },
        disabled: { opacity: 0.5 },
      }),
    [colors]
  );

  // Active account first.
  const ordered = [...accounts].sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0));

  const handleSwitch = async (id: string) => {
    if (busyId || working || id === user?.id) return;
    setBusyId(id);
    const result = await switchAccount(id);
    setBusyId(null);
    if (result.success) {
      resetTo('/');
    } else {
      Alert.alert('Could not switch account', result.message);
    }
  };

  const handleAdd = async () => {
    if (working) return;
    setWorking(true);
    await addAccount();
    resetTo('/auth/login');
  };

  const handleLogout = () => {
    if (working) return;
    Alert.alert('Log out', `Log out of ${user?.name ?? 'this account'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          await logout();
          resetTo('/auth/login');
        },
      },
    ]);
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert('Remove account', `Remove ${name} from this device? You'll need to sign in again to use it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSavedAccount(id) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Accounts
      </Text>
      <Text style={styles.hint}>Tap an account to switch to it.</Text>

      {ordered.map((a) => {
        const isActive = a.id === user?.id;
        return (
          <TouchableOpacity
            key={a.id}
            style={[styles.row, isActive && styles.rowActive]}
            onPress={() => handleSwitch(a.id)}
            disabled={isActive || !!busyId || working}
            accessibilityRole="button"
            accessibilityLabel={isActive ? `${a.name}, current account` : `Switch to ${a.name}`}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(a.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.name}</Text>
              <Text style={styles.meta}>
                {a.email} · {a.role}
              </Text>
            </View>
            {busyId === a.id ? (
              <ActivityIndicator color={colors.primary} />
            ) : isActive ? (
              <Text style={styles.activeTag}>ACTIVE</Text>
            ) : (
              <TouchableOpacity
                onPress={() => handleRemove(a.id, a.name)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${a.name} from this device`}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.addButton, working && styles.disabled]}
        onPress={handleAdd}
        disabled={working}
        accessibilityRole="button"
        accessibilityLabel="Add another account"
      >
        <Text style={styles.addText}>+ Add another account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.logoutButton, working && styles.disabled]}
        onPress={handleLogout}
        disabled={working}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        {working ? <ActivityIndicator color={colors.white} /> : <Text style={styles.logoutText}>Log out</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
