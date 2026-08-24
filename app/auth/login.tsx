import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — calls the live backend. Now branches on all three
// /auth/login outcomes (full success, requiresVerification,
// requiresTwoFactor) instead of assuming a token always comes back.

export default function LoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isWakingServer = useAuthStore((s) => s.isWakingServer);
  const error = useAuthStore((s) => s.error);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
        title: { fontSize: 36, fontWeight: '800', color: colors.primary, textAlign: 'center' },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.xs,
          marginBottom: Spacing.xl,
          letterSpacing: 1,
        },
        form: { gap: Spacing.md },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 14,
          fontSize: 16,
          color: colors.text,
        },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
        wakingNote: { color: colors.textMuted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
        button: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.sm,
        },
        buttonDisabled: { opacity: 0.6 },
        buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
        linkButton: { alignItems: 'center', marginTop: Spacing.sm },
        linkText: { color: colors.textMuted, fontSize: 14 },
        linkTextBold: { color: colors.primary, fontWeight: '700' },
      }),
    [colors]
  );

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    const result = await login(email.trim(), password);

    if (!result.success) {
      if (result.reason === 'requiresVerification') {
        router.push({ pathname: '/auth/verify-otp', params: { userId: result.userId } });
        return;
      }
      if (result.reason === 'requiresTwoFactor') {
        router.push({ pathname: '/auth/verify-login-otp', params: { userId: result.userId } });
        return;
      }
      return;
    }

    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>UniLink</Text>
        <Text style={styles.subtitle}>Connect · Learn · Grow</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {isWakingServer ? (
            <Text style={styles.wakingNote}>
              Waking up the server — this can take up to a minute on a cold start.
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>

          <Link href="/auth/register" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkTextBold}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
