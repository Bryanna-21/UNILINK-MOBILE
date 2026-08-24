import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — completes a 2FA login via /auth/verify-login-otp.
// Requires a userId param, only reachable via login.tsx's
// requiresTwoFactor branch. Redirects to /auth/login if reached
// without one - there is no in-progress login to complete otherwise.
//
// No resend here on purpose: the backend's /auth/resend-otp only
// knows the "verify_signup" purpose. Wiring a resend button to it
// from this screen would issue the WRONG kind of code for an
// already-verified account mid-login - same gap noted on web,
// deferred until a dedicated /resend-login-otp route exists.

export default function VerifyLoginOtpScreen() {
  const colors = useColors();
  const { userId } = useLocalSearchParams<{ userId?: string }>();

  const verifyLoginOtp = useAuthStore((s) => s.verifyLoginOtp);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!userId) {
      router.replace('/auth/login');
      return;
    }
    inputRef.current?.focus();
  }, [userId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
        title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.xs,
          marginBottom: Spacing.xl,
        },
        form: { gap: Spacing.md },
        codeInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingVertical: 16,
          fontSize: 28,
          color: colors.text,
          textAlign: 'center',
          letterSpacing: 8,
        },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
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
      }),
    [colors]
  );

  if (!userId) return null;

  const handleSubmit = async () => {
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }

    const result = await verifyLoginOtp(userId, code.trim());

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Two-Factor Verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to your email to complete login. If you don't see it,
          check your spam or junk folder.
        </Text>

        <View style={styles.form}>
          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify</Text>}
          </TouchableOpacity>

          <Link href="/auth/login" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>Back to login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
