import { useCallback, useMemo, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { LEAD_CHOICES, isPaused, type ReminderPrefs } from '../../src/utils/classSchedule';
import { getLastSync, getReminderPrefs, saveReminderPrefs, syncClassReminders, type SyncResult } from '../../src/utils/classReminders';

// STATUS: REAL. Class reminders: a notification shortly before each class and another when it
// starts. They are set on your phone, so they work without internet, and are refreshed from your
// timetable each time you open UniLink.

const PAUSE_DAYS = 14;

export default function ClassRemindersScreen() {
  const colors = useColors();
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);
  const [last, setLast] = useState<(SyncResult & { at: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl },
        note: { fontSize: 12, color: colors.textMuted, marginBottom: Spacing.md },
        card: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.md },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 6 },
        label: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
        sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border },
        chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
        chipTextOn: { color: colors.white },
        status: { fontSize: 13, color: colors.text },
        warn: { fontSize: 13, color: colors.danger, marginTop: 4 },
        button: { marginTop: Spacing.sm, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
        buttonText: { fontWeight: '700', color: colors.text },
        buttonTextOn: { color: colors.white },
      }),
    [colors]
  );

  const refresh = useCallback(async () => {
    setPrefs(await getReminderPrefs());
    setLast(await getLastSync());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Save a change, then re-plan the reminders straight away.
  const update = async (patch: Partial<ReminderPrefs>) => {
    setBusy(true);
    try {
      setPrefs(await saveReminderPrefs(patch));
      setLast({ ...(await syncClassReminders()), at: Date.now() });
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      setLast({ ...(await syncClassReminders()), at: Date.now() });
    } finally {
      setBusy(false);
    }
  };

  const allowNotifications = async () => {
    try {
      const N = await import('expo-notifications');
      const res = await N.requestPermissionsAsync();
      if (res.status === 'granted') await syncNow();
      else await Linking.openSettings();
    } catch {
      await Linking.openSettings();
    }
  };

  if (!prefs) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Class reminders', headerShown: true }} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      </View>
    );
  }

  const paused = isPaused(prefs);
  const time = last ? new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  let statusText = 'Not set up yet.';
  if (last) {
    if (last.status === 'scheduled') statusText = `${last.reminders} reminders set for ${last.classes} classes (updated ${time}).`;
    else if (last.status === 'off') statusText = 'Class reminders are off.';
    else if (last.status === 'paused') statusText = `Paused until ${new Date(prefs.pausedUntil as string).toLocaleDateString()}.`;
    else if (last.status === 'offline') statusText = `Could not reach UniLink, so your existing reminders were kept (${last.reminders}).`;
    else if (last.status === 'unsupported') statusText = 'Reminders are not available in this version of the app.';
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Class reminders', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>Reminders are set on your phone, so they work without internet. They refresh from your timetable each time you open UniLink.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.label}>Class reminders</Text>
              <Text style={styles.sub}>For every class on your timetable</Text>
            </View>
            <Switch value={prefs.enabled} onValueChange={(v) => update({ enabled: v })} disabled={busy} accessibilityLabel="Class reminders" />
          </View>
        </View>

        {prefs.enabled && (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Before class</Text>
                <Switch value={prefs.before} onValueChange={(v) => update({ before: v })} disabled={busy} accessibilityLabel="Remind me before class" />
              </View>
              {prefs.before && (
                <View style={styles.chips}>
                  {LEAD_CHOICES.map((m) => (
                    <TouchableOpacity key={m} style={[styles.chip, prefs.leadMinutes === m && styles.chipOn]} onPress={() => update({ leadMinutes: m })} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: prefs.leadMinutes === m }}>
                      <Text style={[styles.chipText, prefs.leadMinutes === m && styles.chipTextOn]}>{m} min</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={[styles.row, { marginTop: Spacing.sm }]}>
                <Text style={styles.label}>When class starts</Text>
                <Switch value={prefs.atStart} onValueChange={(v) => update({ atStart: v })} disabled={busy} accessibilityLabel="Remind me when class starts" />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Holidays</Text>
              <Text style={styles.sub}>Timetables repeat every week, so pause reminders when classes are off. Open UniLink after the pause ends and they turn back on by themselves.</Text>
              {paused ? (
                <TouchableOpacity style={styles.button} onPress={() => update({ pausedUntil: null })} disabled={busy} accessibilityRole="button">
                  <Text style={styles.buttonText}>Resume reminders now</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={() => update({ pausedUntil: new Date(Date.now() + PAUSE_DAYS * 86400000).toISOString() })} disabled={busy} accessibilityRole="button">
                  <Text style={styles.buttonText}>Pause for {PAUSE_DAYS} days</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.status}>{statusText}</Text>
          {last?.status === 'no-permission' && (
            <>
              <Text style={styles.warn}>Notifications are turned off for UniLink on this phone, so reminders cannot appear.</Text>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={allowNotifications} accessibilityRole="button">
                <Text style={[styles.buttonText, styles.buttonTextOn]}>Allow notifications</Text>
              </TouchableOpacity>
            </>
          )}
          {Platform.OS === 'android' && (
            <Text style={styles.sub}>If reminders arrive late, your phone's battery saver may be delaying them. Allow UniLink to run in the background in the phone's battery settings.</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={syncNow} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.buttonText}>Update reminders now</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
