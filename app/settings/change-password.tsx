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
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — two-step flow against the live backend:
// 1. requestPasswordChange (re-checks current password, sends OTP)
// 2. confirmPasswordChange (verifies OTP, actually swaps the password)
// Both require an authenticated session - this screen assumes it's
// only reachable from within the authenticated app (settings), same
// as the web equivalent.

type Step = 'request' | 'confirm';

export default function ChangePasswordScreen() {
  const colors = useColors();
  const requestPasswordChange = useAuthStore((s) => s.requestPasswordChange);
  const confirmPasswordChange = useAuthStore((s) => s.confirmPasswordChange);

  const [step, setStep] = useState<Step>('request');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
        title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.xs,
          marginBottom: Spacing.xl,
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
        success: { color: colors.primary, fontSize: 14, textAlign: 'center', fontWeight: '600' },
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

  const handleRequest = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('All fields are required');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    const result = await requestPasswordChange(currentPassword, newPassword, confirmNewPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setStep('confirm');
  };

  const handleConfirm = async () => {
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }

    setLoading(true);
    const result = await confirmPasswordChange(code.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccessMessage(result.message || 'Password changed successfully.');
  };

  if (successMessage) {
    return (
      <View style={[styles.container, styles.content]}>
        <Text style={styles.title}>Password Changed</Text>
        <Text style={styles.success}>{successMessage}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <>
            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.subtitle}>
              Enter your current password and the new one you'd like to use.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="New password (min. 6 characters)"
                placeholderTextColor={colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                editable={!loading}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRequest}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Continue</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Confirm It's You</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code we sent to your email. If you don't see it, check your spam
              or junk folder.
            </Text>

            <View style={styles.form}>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Confirm</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkButton} onPress={() => setStep('request')}>
                <Text style={styles.linkText}>Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
