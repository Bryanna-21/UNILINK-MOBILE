import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

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

export default function EmergencyScreen() {
  const colors = useColors();
  const styles = useEmergencyStyles(colors);
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
        note="Emergency reports and Request Help both submit to the real backend. Live location & trusted contacts (emergency reports only) are not built yet."
      />

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
