import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL — shown on the login screen when this device has saved
// accounts (from "Switch account" or "Add another account"). Without
// it, logging out of one account would strand the others: they'd stay
// saved on the device with no way to reach them.

export function SavedAccounts() {
  const colors = useColors();
  const accounts = useAuthStore((s) => s.accounts);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const [busyId, setBusyId] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: Spacing.lg },
        heading: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: Spacing.sm },
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
        avatar: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarText: { color: colors.white, fontWeight: '800', fontSize: 16 },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        email: { fontSize: 12, color: colors.textMuted },
      }),
    [colors]
  );

  if (accounts.length === 0) return null;

  const handlePick = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const result = await switchAccount(id);
    setBusyId(null);
    if (result.success) {
      router.replace('/(tabs)/home');
    } else {
      Alert.alert('Could not sign in', result.message);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Continue as</Text>
      {accounts.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={styles.row}
          onPress={() => handlePick(a.id)}
          disabled={!!busyId}
          accessibilityRole="button"
          accessibilityLabel={`Continue as ${a.name}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(a.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={styles.email}>{a.email}</Text>
          </View>
          {busyId === a.id ? <ActivityIndicator color={colors.primary} /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}
