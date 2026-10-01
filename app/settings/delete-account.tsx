import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — DELETE /profile/me with { password }.
//
// What "delete" means here, stated honestly because the user is
// entitled to know: the account is anonymized, not erased. Name,
// email, photo, bio, phone and emergency contacts are wiped and every
// session is invalidated, but posts/comments/messages you wrote remain
// and show as "Deleted User", because other people's conversations and
// threads depend on them. The email address is freed for re-registration.
//
// Two guards against accidents: the password must be re-entered, and the
// user must type DELETE. Admin accounts are refused server-side.

export default function DeleteAccountScreen() {
  const colors = useColors();
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = password.length > 0 && confirmText.trim() === 'DELETE' && !loading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.lg, paddingTop: Spacing.xl },
        title: { fontSize: 24, fontWeight: '800', color: colors.danger },
        body: { fontSize: 14, color: colors.text, marginTop: Spacing.sm, lineHeight: 20 },
        bullet: { fontSize: 14, color: colors.text, marginTop: Spacing.xs, lineHeight: 20 },
        form: { gap: Spacing.md, marginTop: Spacing.lg },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          fontSize: 15,
          color: colors.text,
        },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
        button: {
          backgroundColor: colors.danger,
          borderRadius: Radius.md,
          paddingVertical: 14,
          alignItems: 'center',
        },
        buttonDisabled: { opacity: 0.4 },
        buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
        cancel: { alignItems: 'center', marginTop: Spacing.sm },
        cancelText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
      }),
    [colors]
  );

  const handleDelete = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await api.delete('/profile/me', { data: { password } });
      // Session is already dead server-side (tokenVersion bumped);
      // clear local state and send them to login.
      await logout();
      router.replace('/auth/login' as any);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not delete your account. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Delete account
        </Text>
        <StatusBanner status="real" note="This is permanent and cannot be undone." />

        <Text style={styles.body}>What happens when you delete your account:</Text>
        <Text style={styles.bullet}>• You are signed out everywhere immediately.</Text>
        <Text style={styles.bullet}>• Your name, email, photo, bio, phone and emergency contacts are erased.</Text>
        <Text style={styles.bullet}>
          • Posts, comments and messages you wrote stay visible to others, shown as "Deleted User".
        </Text>
        <Text style={styles.bullet}>• You can register again later with the same email as a brand-new account.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            accessibilityLabel="Your password"
          />
          <TextInput
            style={styles.input}
            placeholder='Type DELETE to confirm'
            placeholderTextColor={colors.textMuted}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Type DELETE to confirm"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleDelete}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete my account"
            accessibilityState={{ disabled: !canSubmit, busy: loading }}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Permanently delete my account</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={() => router.back()} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
