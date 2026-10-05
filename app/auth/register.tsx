import { useEffect, useMemo, useState } from 'react';
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
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

interface University {
  _id: string;
  name: string;
}

// STATUS: REAL — calls POST /api/auth/register on the live backend.
// This never returns a token - the account exists but is unverified
// until verify-otp succeeds. Routes there with the returned userId
// instead of assuming a token exists.

export default function RegisterScreen() {
  const colors = useColors();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState('');
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  // Public endpoint, no auth needed — a new user has no token yet.
  useEffect(() => {
    api
      .get('/auth/universities')
      .then((res) => setUniversities(res.data?.data ?? []))
      .catch(() => setUniversities([]))
      .finally(() => setLoadingUniversities(false));
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.xl,
        },
        title: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center' },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.xs,
          marginBottom: Spacing.xl,
        },
        form: { gap: Spacing.md },
        label: { fontSize: 13, fontWeight: '700', color: colors.text },
        universityRow: { marginBottom: Spacing.sm },
        universityChip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          marginRight: Spacing.sm,
        },
        universityChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        universityChipText: { fontSize: 13, color: colors.text },
        universityChipTextActive: { color: colors.white, fontWeight: '700' },
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

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword || !universityId) return;
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      universityId,
      ...(username.trim() ? { username: username.trim() } : {}),
    });

    if (!result.success) {
      // store already set `error`, which renders below.
      return;
    }

    router.push({ pathname: '/auth/verify-otp', params: { userId: result.userId } });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Create Account
        </Text>
        <Text style={styles.subtitle}>Join UniLink</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            editable={!isLoading}
            accessibilityLabel="Full name"
          />
          <TextInput
            style={styles.input}
            placeholder="Username (optional)"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Username, optional"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
            accessibilityLabel="Email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel="Password, minimum 6 characters"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel="Confirm password"
          />

          <Text style={styles.label}>University</Text>
          {loadingUniversities ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.universityRow}>
              {universities.map((u) => (
                <TouchableOpacity
                  key={u._id}
                  style={[styles.universityChip, universityId === u._id && styles.universityChipActive]}
                  onPress={() => setUniversityId(u._id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: universityId === u._id }}
                  accessibilityLabel={u.name}
                >
                  <Text style={[styles.universityChipText, universityId === u._id && styles.universityChipTextActive]}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (isLoading || !universityId) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading || !universityId}
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign Up</Text>}
          </TouchableOpacity>

          <Link href="/auth/login" asChild>
            <TouchableOpacity style={styles.linkButton} accessibilityRole="link">
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
