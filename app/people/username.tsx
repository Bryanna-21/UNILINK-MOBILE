import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL, NEW. Change your username. Live availability check via
// GET /people/username/check, save via PUT /people/me/username (the server enforces the
// rules and the 14-day cooldown; this screen just shows what it says).

type Status =
  | { state: 'idle' }
  | { state: 'own' }
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'bad'; message: string };

export default function UsernameScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const current = user?.username ?? '';
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<Status>({ state: 'own' });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const normalized = value.trim().replace(/^@+/, '').toLowerCase();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, padding: Spacing.lg },
        label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
        },
        at: { fontSize: 16, color: colors.textMuted, marginRight: 2 },
        input: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
        statusText: { fontSize: 13, marginTop: Spacing.sm, minHeight: 18 },
        hint: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.md, lineHeight: 18 },
        button: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.lg,
        },
        buttonDisabled: { opacity: 0.5 },
        buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: Spacing.md },
      }),
    [colors]
  );

  useEffect(() => {
    setServerError(null);
    if (!normalized) {
      setStatus({ state: 'idle' });
      return;
    }
    if (normalized === current) {
      setStatus({ state: 'own' });
      return;
    }
    let cancelled = false;
    setStatus({ state: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/people/username/check', { params: { u: normalized } });
        if (cancelled) return;
        const d = res.data?.data;
        setStatus(d?.available ? { state: 'ok' } : { state: 'bad', message: d?.reason || 'Not available.' });
      } catch (err: any) {
        if (!cancelled) {
          setStatus({ state: 'bad', message: err?.response?.data?.message || 'Could not check right now.' });
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, current]);

  const save = async () => {
    if (!user || status.state !== 'ok' || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      const res = await api.put('/people/me/username', { username: normalized });
      const saved: string = res.data?.data?.username ?? normalized;
      setUser({ ...user, username: saved });
      Alert.alert('Username updated', 'You are now @' + saved + '.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Could not update your username.');
    } finally {
      setSaving(false);
    }
  };

  const statusLine =
    status.state === 'checking'
      ? { text: 'Checking…', color: colors.textMuted }
      : status.state === 'ok'
      ? { text: 'Available', color: colors.primary }
      : status.state === 'own'
      ? { text: 'This is your current username.', color: colors.textMuted }
      : status.state === 'bad'
      ? { text: status.message, color: colors.danger }
      : { text: '', color: colors.textMuted };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Username', headerShown: true }} />

      <Text style={styles.label}>Your username</Text>
      <View style={styles.inputRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          maxLength={21}
          accessibilityLabel="Username"
        />
      </View>
      <Text style={[styles.statusText, { color: statusLine.color }]} accessibilityLiveRegion="polite">
        {statusLine.text}
      </Text>

      <Text style={styles.hint}>
        3 to 20 characters: letters, numbers, dots and underscores. People find you by this name. After you
        change it you can change it again after 14 days.
      </Text>

      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}

      <TouchableOpacity
        style={[styles.button, (status.state !== 'ok' || saving) && styles.buttonDisabled]}
        onPress={save}
        disabled={status.state !== 'ok' || saving}
        accessibilityRole="button"
        accessibilityLabel="Save username"
        accessibilityState={{ disabled: status.state !== 'ok' || saving, busy: saving }}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}
