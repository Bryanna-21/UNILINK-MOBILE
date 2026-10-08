import { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { useAuthStore } from '../src/store/authStore';
import { useThemeStore } from '../src/store/themeStore';
import { useColors, Radius, Spacing } from '../src/constants/theme';
import { initI18n } from '../src/i18n';
import { promptBiometric } from '../src/utils/biometricAuth';
import { LoadingSplash } from '../src/components/LoadingSplash';
import { registerForPushNotifications } from '../src/utils/pushNotifications';

// STATUS: REAL — expo-updates is configured via `eas update:configure`
// (see app.json's updates.url/runtimeVersion and eas.json's channels).
//
// This explicit check runs shortly after startup so the app can silently
// download a newer production OTA bundle without delaying authentication,
// navigation, or the initial render. Once the bundle is downloaded,
// `reloadAsync()` applies it immediately rather than waiting for another
// cold launch. Development/Expo Go launches are ignored.
function useSilentUpdateCheck() {
  useEffect(() => {
    let cancelled = false;

    const checkAndApplyUpdate = async () => {
      // OTA updates only run in a real EAS-built app.
      // Expo Go/development launches should continue normally.
      if (!Updates.isEnabled || __DEV__) return;

      try {
        const result = await Updates.checkForUpdateAsync();

        if (cancelled || !result.isAvailable) {
          if (!result.isAvailable) {
            console.log('[updates] Already on the latest version.');
          }
          return;
        }

        console.log('[updates] New update available — downloading.');

        const fetched = await Updates.fetchUpdateAsync();

        if (cancelled || !fetched.isNew) {
          return;
        }

        console.log('[updates] Update downloaded — applying now.');

        // Apply the downloaded production OTA immediately.
        // This replaces the running JS bundle with the new one.
        await Updates.reloadAsync();
      } catch (err) {
        // Updates are never allowed to break app startup.
        // Offline clients simply continue using their current bundle.
        console.log('[updates] Automatic update check failed (non-fatal):', err);
      }
    };

    // Let the app render first. Updating must never delay the splash,
    // authentication, navigation, or normal startup experience.
    const timer = setTimeout(() => {
      if (!cancelled) {
        checkAndApplyUpdate();
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
}

// STATUS: REAL — shown when authStore.hydrate() found a valid stored
// session but biometric lock is enabled, so the session is being held
// back until the scan succeeds (see authStore.ts's pendingBiometricUnlock).
//
// Per an explicit product decision: a failed/cancelled scan re-prompts
// rather than silently falling back to the manual login screen — a
// smudged thumb or a bad angle is not evidence anything is wrong, and
// shouldn't cost the user their session. The escape hatch to password
// login is explicit and separate (the "Use password instead" button),
// never automatic. Choosing it calls authStore.logout(), which clears
// the held user AND the stored token/session — this is a deliberate,
// user-initiated "I don't want to unlock with biometrics right now,
// start over" action, not a silent fallback.
function BiometricUnlockScreen() {
  const colors = useColors();
  const completeBiometricUnlock = useAuthStore((s) => s.completeBiometricUnlock);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<'prompting' | 'failed'>('prompting');
  const [isRetrying, setIsRetrying] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          padding: Spacing.lg,
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginTop: Spacing.lg,
          marginBottom: Spacing.xs,
        },
        subtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginBottom: Spacing.lg,
        },
        retryButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 14,
          paddingHorizontal: Spacing.xl,
          marginBottom: Spacing.sm,
        },
        retryButtonText: {
          color: colors.white,
          fontWeight: '700',
          fontSize: 15,
        },
        fallbackButton: {
          paddingVertical: Spacing.sm,
        },
        fallbackButtonText: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: '600',
        },
      }),
    [colors]
  );

  const runPrompt = async () => {
    setIsRetrying(true);
    setStatus('prompting');
    const result = await promptBiometric();
    setIsRetrying(false);
    if (result === 'success') {
      completeBiometricUnlock();
      return;
    }
    // 'cancelled' and 'unavailable' both land here: per the retry
    // rule above, this is "let them try again", not "fall back
    // automatically" — even 'unavailable' (e.g. hardware disabled
    // mid-session) surfaces the same retry/fallback choice rather
    // than silently logging the user out.
    setStatus('failed');
  };

  // Auto-run the first prompt on mount, so the user sees the OS
  // Face ID/fingerprint sheet immediately rather than having to tap
  // a button first — subsequent attempts are user-initiated via the
  // Try Again button.
  useEffect(() => {
    runPrompt();
  }, []);

  return (
    <View style={styles.container}>
      {isRetrying ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {status === 'failed' ? "Didn't quite catch that" : 'Unlock UniLink'}
          </Text>
          <Text style={styles.subtitle}>
            {status === 'failed'
              ? 'The scan wasn\'t recognized. Give it another try.'
              : 'Confirm your identity to continue.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={runPrompt}
            accessibilityRole="button"
            accessibilityLabel="Try biometric unlock again"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={() => logout()}
            accessibilityRole="button"
            accessibilityLabel="Use password instead"
          >
            <Text style={styles.fallbackButtonText}>Use password instead</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function RootLayout() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const pendingBiometricUnlock = useAuthStore((s) => s.pendingBiometricUnlock);
  const userId = useAuthStore((s) => s.user?.id);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const isThemeHydrated = useThemeStore((s) => s.isHydrated);
  const themeMode = useThemeStore((s) => s.mode);
  const colors = useColors();
  const [isI18nReady, setIsI18nReady] = useState(false);
  // Hold the branded splash for a moment so the hand-off from the native splash
  // is smooth and the loading dots are actually seen, instead of flashing past.
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
    initI18n().then(() => setIsI18nReady(true));
    const splashTimer = setTimeout(() => setMinSplashDone(true), 900);
    return () => clearTimeout(splashTimer);
  }, []);

  // Fires whenever a real, resolved user becomes present — covers
  // both a fresh login (handled elsewhere) and the biometric-unlock
  // path (completeBiometricUnlock releasing the held user) with one
  // shared trigger point, rather than duplicating this call in every
  // place `user` can become non-null. Keyed on userId specifically so
  // it doesn't re-fire on every unrelated user-object update (e.g. a
  // profile edit) — only on an actual null-to-present transition or a
  // genuine account switch.
  useEffect(() => {
    if (userId) {
      registerForPushNotifications();
    }
  }, [userId]);

  useSilentUpdateCheck();

  // Expo Router provides the SafeAreaProvider; these are the status-bar / navigation-bar sizes.
  const insets = useSafeAreaInsets();

  // Wait on auth, theme, AND i18n hydration before rendering real UI —
  // same reasoning as the existing auth/theme gate: rendering before
  // i18n resolves its saved/device language would show raw
  // translation keys for a moment, the string equivalent of the
  // light-mode color flash this gate already prevents.
  const isHydrated = isAuthHydrated && isThemeHydrated && isI18nReady && minSplashDone;

  if (!isHydrated) {
    return <LoadingSplash />;
  }

  // Checked AFTER the hydration gate, deliberately: hydrateAuth()
  // itself is what decides whether pendingBiometricUnlock gets raised
  // in the first place (see authStore.ts), so this can only be
  // meaningfully true once hydration has actually finished. Rendered
  // as its own full-screen state, distinct from both the auth stack
  // and the tabs — the Stack below (and therefore any real app
  // content or the login screen) never mounts while this is true.
  if (pendingBiometricUnlock) {
    return (
      <>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <BiometricUnlockScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          // No screen has a native header, so keep content clear of the status bar and the
          // navigation bar here, once, for every screen.
          contentStyle: { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        }}
      >
        {/* Auth screens live under app/auth/* and are discovered directly by Expo Router. */}
        {/* The tab bar already pads for the bottom inset itself; padding here too would double it. */}
        <Stack.Screen
          name="(tabs)"
          options={{ contentStyle: { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: 0 } }}
        />

        {/* Secondary app routes that must open outside the tab navigator. */}
        <Stack.Screen
          name="chat/[id]"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          }}
        />

        <Stack.Screen
          name="messages/new"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          }}
        />
      </Stack>
    </>
  );
}
