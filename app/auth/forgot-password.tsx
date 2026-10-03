import { useMemo, useRef, useState } from 'react';
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

// STATUS: REAL — mirrors web's src/pages/auth/ForgotPassword.js exactly.
// Two steps: (1) email -> POST /auth/forgot-password issues a code,
// (2) email + code + new password -> POST /auth/reset-password. Both
// calls go through authStore's forgotPassword/resetPassword, which use
// the identical payload shape as web's AuthContext.js (confirmed by
// reading it directly, not inferred). No pre-login session exists at
// this point, so this is distinct from settings/change-password.tsx,
// which requires an authenticated user.

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const codeInputRef = useRef<TextInput>(null);

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
          paddingHorizontal: Spacing.sm,
        },
        form: { gap: Spacing.md },
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
        passwordRow: { position: 'relative', justifyContent: 'center' },
        passwordToggle: { position: 'absolute', right: Spacing.md },
        passwordToggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
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

  const handleRequestCode = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setStep('reset');
    setTimeout(() => codeInputRef.current?.focus(), 100);
  };

  const handleResetPassword = async () => {
    setError('');
    if (!code.trim()) {
      setError('Code is required');
      return;
    }
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setError('Please fill in both password fields');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await resetPassword(email.trim(), code.trim(), newPassword, confirmNewPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    router.replace('/auth/login');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Reset Password
        </Text>

        {step === 'email' ? (
          <>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a code to reset your password.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="University Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                accessibilityLabel="University email"
              />

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRequestCode}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Send reset code"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Enter the code sent to {email} and choose a new password.</Text>

            <View style={styles.form}>
              <TextInput
                ref={codeInputRef}
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                accessibilityLabel="6-digit verification code"
              />

              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  accessibilityLabel="New password"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textMuted}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                accessibilityLabel="Confirm new password"
              />

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Reset password"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Link href="/auth/login" asChild>
          <TouchableOpacity style={styles.linkButton} accessibilityRole="link">
            <Text style={styles.linkText}>Back to login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
