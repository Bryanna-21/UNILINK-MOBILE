import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Linking,
  Vibration,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// SOS (Phase 1): press-and-hold 3s, then a 5s cancellable countdown, then POST
// /emergency/report with type "sos" (backend already gives it high priority, alerts admins
// and texts trusted contacts if SMS is configured). No GPS yet: that needs expo-location
// (a native package, so a new EAS build). The person can type where they are instead.
// Call buttons use the system dialer via tel: (no dependency).
//
// STATUS: REAL — calls POST /api/emergency/report on the live backend.
// type must be exactly "medical" | "safety" | "abuse" (enforced by the
// backend controller). Live location, trusted contacts, campus security
// integration, and the SOS button from the spec are NOT built — this
// is a report-submission form plus a link to view your own past
// reports (see emergency/my-reports.tsx), nothing more.
//
// Request Help (below the emergency form) is ALSO now REAL — calls
// POST /api/emergency/help, which used to be a stub returning 200
// with no persistence at all. It is deliberately styled and worded
// as distinct from the emergency form above: this is for routine,
// non-urgent assistance ("I need help finding X", "I'm stuck on Y"),
// not a fourth emergency type, and it does not use the danger-red
// treatment the emergency types use above.

const EMERGENCY_TYPES = [
  { value: 'medical', label: '🏥 Medical', a11yLabel: 'Medical' },
  { value: 'safety', label: '⚠️ Safety', a11yLabel: 'Safety' },
  { value: 'abuse', label: '🚫 Abuse', a11yLabel: 'Abuse' },
] as const;

const HOLD_MS = 3000;
const COUNTDOWN_FROM = 5;
const FALLBACK_CONTACTS = [
  { name: 'National Emergency', phone: '112' },
  { name: 'Ambulance', phone: '999' },
];

export default function EmergencyScreen() {
  const colors = useColors();
  const styles = useEmergencyStyles(colors);

  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>(FALLBACK_CONTACTS);
  const [sosPlace, setSosPlace] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api
      .get('/emergency/contacts')
      .then((res) => {
        const list = res.data?.data;
        if (Array.isArray(list) && list.length) setContacts(list);
      })
      .catch(() => {});
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const sendSos = useCallback(async () => {
    setIsSendingSos(true);
    try {
      const res = await api.post('/emergency/report', {
        type: 'sos',
        location: sosPlace.trim() || undefined,
      });
      const notified = res.data?.data?.notifiedContacts;
      const extra = Array.isArray(notified) && notified.length ? ' Your trusted contacts were also alerted.' : '';
      Alert.alert('SOS sent', 'Campus security has been alerted.' + extra);
    } catch (err: any) {
      Alert.alert(
        'SOS could not be sent',
        (err?.response?.data?.message || 'Check your connection.') + ' If you are in danger, call emergency services now.'
      );
    } finally {
      setIsSendingSos(false);
    }
  }, [sosPlace]);

  // Countdown: one tick per second; at 0 the alert is sent. Cancel sets countdown back to null.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      sendSos();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, sendSos]);

  const beginHold = () => {
    if (countdown !== null || isSendingSos) return;
    holdProgress.setValue(0);
    Animated.timing(holdProgress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      Vibration.vibrate(200);
      holdProgress.setValue(0);
      setCountdown(COUNTDOWN_FROM);
    }, HOLD_MS);
  };

  const endHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      holdProgress.stopAnimation();
      holdProgress.setValue(0);
    }
  };
  const [type, setType] = useState<'medical' | 'safety' | 'abuse' | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [helpMessage, setHelpMessage] = useState('');
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);

  const handleSubmitHelp = async () => {
    if (!helpMessage.trim()) {
      Alert.alert('Add a note', 'Let us know briefly what you need help with.');
      return;
    }
    setIsSubmittingHelp(true);
    try {
      await api.post('/emergency/help', { message: helpMessage.trim() });
      Alert.alert('Request sent', 'Your request has been sent. Support will reach out.');
      setHelpMessage('');
    } catch (err: any) {
      Alert.alert(
        'Could not submit',
        err?.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSubmittingHelp(false);
    }
  };

  const handleSubmit = async () => {
    if (!type) {
      Alert.alert('Select a type', 'Please choose what kind of emergency this is.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/emergency/report', { type, message: message.trim() || undefined });
      Alert.alert('Report sent', 'Your emergency report has been submitted.');
      setType(null);
      setMessage('');
    } catch (err: any) {
      Alert.alert(
        'Could not submit',
        err?.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBanner
        status="real"
        note="SOS, emergency reports and Request Help all submit to the real backend. Live GPS location is not built yet; say where you are in the box below."
      />

      <View style={styles.sosSection}>
        {countdown !== null ? (
          <View style={styles.countdownCard} accessibilityLiveRegion="assertive">
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Text style={styles.countdownText}>Sending SOS to campus security…</Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCountdown(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel SOS"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale: holdProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] }}>
              <TouchableOpacity
                style={[styles.sosButton, isSendingSos && styles.submitButtonDisabled]}
                onPressIn={beginHold}
                onPressOut={endHold}
                activeOpacity={0.85}
                disabled={isSendingSos}
                accessibilityRole="button"
                accessibilityLabel="SOS. Press and hold for 3 seconds to send an emergency alert"
                accessibilityHint="Holding for three seconds starts a five second countdown that you can cancel"
              >
                {isSendingSos ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sosText}>SOS</Text>}
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.holdTrack}>
              <Animated.View style={[styles.holdFill, { width: holdProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            </View>
            <Text style={styles.sosHint}>Press and hold for 3 seconds. You can cancel during the countdown.</Text>
            <TextInput
              style={[styles.messageInput, { minHeight: 48, marginTop: Spacing.sm }]}
              placeholder="Where are you? (optional, e.g. Library, 2nd floor)"
              placeholderTextColor={colors.textMuted}
              value={sosPlace}
              onChangeText={setSosPlace}
              accessibilityLabel="Where are you, optional"
            />
          </>
        )}

        <Text style={styles.callLabel}>CALL NOW</Text>
        <View style={styles.callRow}>
          {contacts.map((c) => (
            <TouchableOpacity
              key={c.name + c.phone}
              style={styles.callButton}
              onPress={() => Linking.openURL('tel:' + c.phone)}
              accessibilityRole="button"
              accessibilityLabel={'Call ' + c.name + ' on ' + c.phone}
            >
              <Text style={styles.callName}>{c.name}</Text>
              <Text style={styles.callNumber}>{c.phone}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        Report an Emergency
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/emergency/my-reports' as any)}
        accessibilityRole="button"
        accessibilityLabel="View my past reports"
      >
        <Text style={styles.myReportsLink}>View my reports →</Text>
      </TouchableOpacity>

      <View style={styles.typeRow} accessibilityRole="radiogroup">
        {EMERGENCY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeButton, type === t.value && styles.typeButtonActive]}
            onPress={() => setType(t.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: type === t.value }}
            accessibilityLabel={t.a11yLabel}
          >
            <Text
              style={[
                styles.typeButtonText,
                type === t.value && styles.typeButtonTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.messageInput}
        placeholder="Describe what's happening (optional)"
        placeholderTextColor={colors.textMuted}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        accessibilityLabel="Describe what's happening, optional"
      />

      <TouchableOpacity
        style={[styles.submitButton, (!type || isSubmitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!type || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit report"
        accessibilityState={{ disabled: !type || isSubmitting, busy: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>Submit Report</Text>
        )}
      </TouchableOpacity>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle} accessibilityRole="header">
          Request Help
        </Text>
        <Text style={styles.helpSubtitle}>
          Not an emergency? Use this for routine assistance — support will follow up, not respond urgently.
        </Text>

        <TextInput
          style={styles.messageInput}
          placeholder="What do you need help with?"
          placeholderTextColor={colors.textMuted}
          value={helpMessage}
          onChangeText={setHelpMessage}
          multiline
          numberOfLines={3}
          accessibilityLabel="What do you need help with"
        />

        <TouchableOpacity
          style={[styles.helpButton, (!helpMessage.trim() || isSubmittingHelp) && styles.submitButtonDisabled]}
          onPress={handleSubmitHelp}
          disabled={!helpMessage.trim() || isSubmittingHelp}
          accessibilityRole="button"
          accessibilityLabel="Send help request"
          accessibilityState={{ disabled: !helpMessage.trim() || isSubmittingHelp, busy: isSubmittingHelp }}
        >
          {isSubmittingHelp ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Send Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Theme-aware styles, rebuilt whenever the active palette changes —
// same pattern as courses.tsx / community.tsx / explore.tsx. Do not
// revert this to a module-level StyleSheet.create with a static
// Colors import; that is the exact bug this fixed (screen stayed
// white in dark mode because it never re-rendered on theme toggle).
function useEmergencyStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          padding: Spacing.md,
        },
        title: {
          fontSize: 20,
          fontWeight: '800',
          color: colors.text,
          marginTop: Spacing.md,
          marginBottom: Spacing.md,
        },
        myReportsLink: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.primary,
          marginBottom: Spacing.md,
        },
        typeRow: {
          flexDirection: 'row',
          gap: Spacing.sm,
          marginBottom: Spacing.md,
        },
        typeButton: {
          flex: 1,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
        },
        typeButtonActive: {
          borderColor: colors.danger,
          backgroundColor: colors.background === '#0A0A0A' ? '#3A1414' : '#FEF2F2',
        },
        typeButtonText: {
          fontSize: 13,
          color: colors.text,
        },
        typeButtonTextActive: {
          color: colors.danger,
          fontWeight: '700',
        },
        messageInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 15,
          color: colors.text,
          minHeight: 100,
          textAlignVertical: 'top',
        },
        submitButton: {
          backgroundColor: colors.danger,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.lg,
        },
        submitButtonDisabled: {
          opacity: 0.5,
        },
        submitButtonText: {
          color: colors.white,
          fontWeight: '700',
          fontSize: 16,
        },
        // Request Help section deliberately uses colors.primary, not
        // colors.danger — visually distinct from the emergency form
        // above so it reads as "routine assistance", not "urgent".
        helpSection: {
          marginTop: Spacing.xl,
          paddingTop: Spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        helpTitle: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.text,
          marginBottom: Spacing.xs,
        },
        helpSubtitle: {
          fontSize: 13,
          color: colors.textMuted,
          marginBottom: Spacing.md,
        },
        sosSection: { alignItems: 'center', marginBottom: Spacing.lg },
        sosButton: {
          width: 168,
          height: 168,
          borderRadius: 84,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 8,
          borderColor: colors.background === '#0A0A0A' ? '#5B1A1A' : '#FECACA',
        },
        sosText: { color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: 2 },
        holdTrack: { width: 168, height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: Spacing.md, overflow: 'hidden' },
        holdFill: { height: 6, backgroundColor: colors.danger },
        sosHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
        countdownCard: {
          alignSelf: 'stretch',
          alignItems: 'center',
          backgroundColor: colors.danger,
          borderRadius: Radius.md,
          padding: Spacing.lg,
        },
        countdownNumber: { color: colors.white, fontSize: 64, fontWeight: '800' },
        countdownText: { color: colors.white, fontSize: 15, fontWeight: '600', marginBottom: Spacing.md },
        cancelButton: { backgroundColor: colors.white, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 40 },
        cancelButtonText: { color: colors.danger, fontWeight: '800', fontSize: 16 },
        callLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: Spacing.lg },
        callRow: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
        callButton: {
          flexGrow: 1,
          minWidth: 100,
          minHeight: 52,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.sm,
        },
        callName: { fontSize: 12, color: colors.textMuted },
        callNumber: { fontSize: 16, fontWeight: '800', color: colors.text },
        helpButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: Spacing.md,
        },
      }),
    [colors]
  );
}
