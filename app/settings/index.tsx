import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ShellScreen } from '../../src/components/ShellScreen';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { useThemeStore } from '../../src/store/themeStore';

// STATUS: Appearance/Dark mode and "Change password" are now REAL —
// everything else on this screen is still SHELL (i18n for languages,
// expo-notifications for push prefs, dedicated settings routes for
// privacy/security beyond password, offline downloads for storage,
// accessibility props screen-by-screen). Those remain listed via
// ShellScreen below, unchanged, each still stating exactly what it's
// waiting on.

export default function SettingsScreen() {
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

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
        <Text style={styles.sectionTitle}>Security</Text>
        <StatusBanner status="real" note="Password changes are confirmed by email code, same as the web app." />
        <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/change-password')}>
          <Text style={styles.rowText}>Change password</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <ShellScreen
        title=""
        sections={[
          {
            title: 'Notifications',
            items: ['Push notification preferences'],
            backendNote: 'Needs: expo-notifications + backend to actually trigger pushes.',
          },
          {
            title: 'Privacy & Security',
            items: ['Privacy settings', 'Security settings'],
            backendNote: 'Needs: dedicated settings routes on the User model. (Change password is now real - see the Security section above.)',
          },
          {
            title: 'Storage',
            items: ['Downloads', 'Storage usage'],
            backendNote: 'Needs: offline download feature to exist first.',
          },
          {
            title: 'Language',
            items: [
              'English', 'Swahili', 'French', 'Arabic', 'Spanish',
              'German', 'Chinese', 'Japanese', 'Portuguese', 'Russian',
            ],
            backendNote: 'Needs: an i18n library (e.g. i18next) + real translated strings for every screen — this is a large, real effort, not a dropdown.',
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
