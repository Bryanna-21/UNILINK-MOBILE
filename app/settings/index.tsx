import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ShellScreen } from '../../src/components/ShellScreen';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { useThemeStore } from '../../src/store/themeStore';
import { SUPPORTED_LANGUAGES, TRANSLATED_LANGUAGES, changeLanguage, LanguageCode } from '../../src/i18n';
import { isBiometricEnabled, isBiometricSupported, setBiometricEnabled } from '../../src/utils/biometricAuth';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategoryKey,
  getNotificationPrefs,
  setNotificationPref,
} from '../../src/utils/notificationPrefs';

// STATUS: Appearance/Dark mode, Change password, Language, Biometric
// unlock, and — new tonight — Push notification preferences are all
// REAL now. Push preferences are CLIENT-SIDE ONLY, deliberately — see
// notificationPrefs.ts's header comment for exactly what that means
// and doesn't mean (it suppresses the foreground in-app alert for a
// muted category; it does not stop the server from sending, and has
// no effect on background/closed-app OS notifications). A genuine
// server-side preference is a separate, not-yet-made change to
// notifyUsers.middleware.js. Registration for push itself (requesting
// permission, getting a token, calling the already-real
// POST /profile/push-token) is also new tonight — see
// pushNotifications.ts. Everything else on this screen (privacy/
// security beyond password and biometrics, offline storage beyond the
// dashboard/courses read-cache, per-screen accessibility) remains
// SHELL, unchanged, each still stating exactly what it's waiting on.

export default function SettingsScreen() {
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const { i18n } = useTranslation();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [checkingSupport, setCheckingSupport] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<Record<NotificationCategoryKey, boolean> | null>(null);

  useEffect(() => {
    (async () => {
      const [supported, enabled] = await Promise.all([isBiometricSupported(), isBiometricEnabled()]);
      setBiometricSupported(supported);
      // Never show the switch as "on" if the device can't actually
      // back it — e.g. the user enrolled Face ID once, enabled this,
      // then removed all Face ID enrollments. hydrate() in authStore
      // already re-checks this at cold-start too; this just keeps the
      // Settings UI itself from lying in the same way.
      setBiometricOn(supported && enabled);
      setCheckingSupport(false);
    })();
    getNotificationPrefs().then(setNotifPrefs);
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    if (value && !biometricSupported) {
      Alert.alert(
        'Not available',
        'Your device has no Face ID or fingerprint enrolled. Set one up in your phone settings first.'
      );
      return;
    }
    setBiometricOn(value);
    await setBiometricEnabled(value);
  };

  const handleToggleNotifPref = async (key: NotificationCategoryKey, value: boolean) => {
    setNotifPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    await setNotificationPref(key, value);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          padding: Spacing.md,
          paddingTop: Spacing.xl,
        },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        section: {
          marginTop: Spacing.lg,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        rowText: {
          fontSize: 14,
          color: colors.text,
        },
        rowChevron: {
          fontSize: 18,
          color: colors.textMuted,
        },
        languageRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.xs,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        languageRowActive: { borderColor: colors.primary },
        languageLabel: { fontSize: 14, color: colors.text },
        languageNativeLabel: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
        languageStub: { fontSize: 11, color: colors.textMuted, marginTop: 1, fontStyle: 'italic' },
        checkmark: { fontSize: 16, color: colors.primary, fontWeight: '700' },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <StatusBanner status="real" note="Dark mode is live and saved to your device." />
        <View style={styles.row}>
          <Text style={styles.rowText}>Dark mode</Text>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <StatusBanner
          status="real"
          note="Push registration is live — your device now registers for real push notifications. These per-category switches only control whether a notification shows while the app is open; they don't yet stop the server from sending it."
        />
        {NOTIFICATION_CATEGORIES.map(({ key, label }) => (
          <View key={key} style={styles.row}>
            <Text style={styles.rowText}>{label}</Text>
            <Switch
              value={notifPrefs ? notifPrefs[key] : true}
              onValueChange={(value) => handleToggleNotifPref(key, value)}
              disabled={!notifPrefs}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <StatusBanner
          status="real"
          note="Password changes are confirmed by email code, same as the web app. Biometric unlock gates your existing session locally — it does not change how you log in."
        />
        <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/change-password')}>
          <Text style={styles.rowText}>Change password</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowText}>
            {biometricSupported ? 'Unlock with Face ID / fingerprint' : 'Biometric unlock (unavailable)'}
          </Text>
          <Switch
            value={biometricOn}
            onValueChange={handleToggleBiometric}
            disabled={checkingSupport}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <StatusBanner
          status="real"
          note="Language selection is real and saved to your device. Only English is fully translated so far — other languages fall back to English until translated."
        />
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = i18n.language === lang.code;
          const isTranslated = TRANSLATED_LANGUAGES.includes(lang.code as LanguageCode);
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageRow, isActive && styles.languageRowActive]}
              onPress={() => changeLanguage(lang.code as LanguageCode)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={`${lang.label}${isTranslated ? '' : ', not yet translated'}`}
            >
              <View>
                <Text style={styles.languageLabel}>{lang.label}</Text>
                <Text style={styles.languageNativeLabel}>{lang.nativeLabel}</Text>
                {!isTranslated ? <Text style={styles.languageStub}>Not yet translated — showing English</Text> : null}
              </View>
              {isActive ? (
                <Text style={styles.checkmark} accessibilityElementsHidden importantForAccessibility="no">
                  ✓
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <ShellScreen
        title=""
        sections={[
          {
            title: 'Privacy & Security',
            items: [
              'Two-factor authentication',
              'Active sessions',
              'Blocked users',
              'Who can message me',
              'Download my data',
              'Delete my account',
            ],
            backendNote: 'Scoped but not yet built. Two-factor authentication and active-session listing extend existing OTP/auth infrastructure. Blocked users and messaging-privacy need new fields on the User model plus enforcement in message.controller.js. Download-my-data and delete-account need dedicated export/deletion endpoints. None of these have a backend route yet — building these next, after this shell ships.',
          },
          {
            title: 'Storage',
            items: ['Downloads', 'Storage usage'],
            backendNote: 'A real offline read-cache now exists (dashboard, courses) but there is no user-facing "manage downloads" or storage-usage UI yet — that\'s still a separate feature.',
          },
          {
            title: 'Accessibility',
            items: ['Screen reader support', 'Large text', 'High contrast', 'Reduced motion'],
            backendNote: 'Needs: accessibility props added screen-by-screen (React Native has real APIs for this — genuine work, not a toggle).',
          },
        ]}
      />
    </ScrollView>
  );
}
