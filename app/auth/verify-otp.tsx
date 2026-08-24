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

// STATUS: REAL — confirms the signup OTP via /auth/verify-otp on the
// live backend. Requires a userId param, passed via router.push from
// either register.tsx or login.tsx's requiresVerification branch. If
// this screen is somehow reached without one (deep link, stale nav
// state), it redirects to /auth/register rather than rendering a
// form that can never succeed.

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpScreen() {
  const colors = useColors();
  const { userId } = useLocalSearchParams<{ userId?: string }>();

  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!userId) {
      router.replace('/auth/register');
      return;
    }
    inputRef.current?.focus();
  }, [userId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
        title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
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
        resendText: { color: colors.primary, fontWeight: '700' },
        resendTextDisabled: { color: colors.textMuted, fontWeight: '700' },
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

    const result = await verifyOtp(userId, code.trim());

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.replace('/(tabs)/home');
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    const result = await resendOtp(userId);
    setResending(false);

    if (result.success) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setError(result.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to your email. If you don't see it, check your spam or
          junk folder.
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

          <TouchableOpacity style={styles.linkButton} onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Text style={styles.linkText}>
              Didn't get a code?{' '}
              <Text style={cooldown > 0 ? styles.resendTextDisabled : styles.resendText}>
                {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Text>
            </Text>
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
