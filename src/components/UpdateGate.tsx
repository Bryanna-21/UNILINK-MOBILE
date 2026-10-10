import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useColors, Radius, Spacing } from '../constants/theme';
import { compareVersions } from '../utils/appVersion';

// STATUS: REAL. Tells people on an old installed version that a new one exists.
// Over-the-air updates only reach apps with the SAME version number (runtimeVersion policy
// "appVersion"), so once a rebuild bumps the version, old phones stop getting updates and
// need this prompt. Settings come from GET /config (env vars on the backend):
//   latestVersion  newer than the installed app -> dismissible banner, reshown at most daily
//   minVersion     newer than the installed app -> full-screen "Update required", not dismissible
// Both open downloadUrl. Any failure (offline, bad config) shows nothing and never blocks the app.
// Android cannot install a downloaded APK silently, so the person still confirms the install.

const DISMISS_KEY = 'unilink_update_dismissed';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Pending {
  latest: string | null;
  url: string;
  message: string | null;
  forced: boolean;
}

export function UpdateGate() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          position: 'absolute',
          left: Spacing.md,
          right: Spacing.md,
          zIndex: 1000,
          elevation: 12,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.primary,
          padding: Spacing.md,
          gap: Spacing.sm,
        },
        title: { color: colors.text, fontSize: 15, fontWeight: '700' },
        body: { color: colors.textMuted, fontSize: 13 },
        row: { flexDirection: 'row', gap: Spacing.sm },
        primary: {
          flex: 1,
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 12,
          alignItems: 'center',
        },
        primaryText: { color: colors.white, fontWeight: '700' },
        secondary: {
          paddingVertical: 12,
          paddingHorizontal: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        },
        secondaryText: { color: colors.text, fontWeight: '600' },
        full: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          padding: Spacing.xl,
          gap: Spacing.md,
        },
        fullTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
      }),
    [colors]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/config');
        const app = res.data?.data?.app;
        if (!app?.downloadUrl) return;
        const current = Constants.expoConfig?.version ?? '0.0.0';

        const forced = !!app.minVersion && compareVersions(current, app.minVersion) < 0;
        const newer = !!app.latestVersion && compareVersions(current, app.latestVersion) < 0;
        if (!forced && !newer) return;

        if (!forced) {
          const saved = await SecureStore.getItemAsync(DISMISS_KEY).catch(() => null);
          const [savedVersion, savedAt] = (saved ?? '').split('|');
          if (savedVersion === app.latestVersion && Date.now() - Number(savedAt) < DAY_MS) return;
        }

        if (!cancelled) {
          setPending({ latest: app.latestVersion, url: app.downloadUrl, message: app.message, forced });
        }
      } catch {
        // Offline or misconfigured: no prompt, app carries on.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pending) return null;

  const openLink = () => {
    Linking.openURL(pending.url).catch(() => {});
  };
  const later = () => {
    SecureStore.setItemAsync(DISMISS_KEY, `${pending.latest}|${Date.now()}`).catch(() => {});
    setPending(null);
  };

  if (pending.forced) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => {}}>
        <View style={styles.full}>
          <Text style={styles.fullTitle}>Update required</Text>
          <Text style={styles.body}>
            {pending.message || 'This version of UniLink is no longer supported. Please install the latest version to continue.'}
          </Text>
          <TouchableOpacity style={styles.primary} onPress={openLink} accessibilityRole="button" accessibilityLabel="Download the update">
            <Text style={styles.primaryText}>Update now</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.banner, { top: insets.top + Spacing.sm }]} accessibilityLiveRegion="polite">
      <Text style={styles.title}>A new version of UniLink is available</Text>
      <Text style={styles.body}>{pending.message || `Version ${pending.latest} has new features and fixes.`}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.primary} onPress={openLink} accessibilityRole="button" accessibilityLabel="Download the update">
          <Text style={styles.primaryText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={later} accessibilityRole="button" accessibilityLabel="Remind me later">
          <Text style={styles.secondaryText}>Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
