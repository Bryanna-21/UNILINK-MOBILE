import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: SHELL — "RSVP" below only flips local state, nothing is
// saved anywhere. QR check-in shows a placeholder box, not a real
// generated code (would need a QR-generation library + a scan/verify
// backend route once RSVPs are real).

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isRsvped, setIsRsvped] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <StatusBanner
        status="shell"
        note={`Event "${id}" — RSVP is local-only. Needs: Event model, RSVP model, QR generation.`}
      />

      <View style={styles.card}>
        <Text style={styles.title}>Placeholder Event</Text>
        <Text style={styles.meta}>Date, time, and location would appear here.</Text>

        <TouchableOpacity
          style={[styles.rsvpButton, isRsvped && styles.rsvpButtonActive]}
          onPress={() => setIsRsvped((v) => !v)}
        >
          <Text style={[styles.rsvpButtonText, isRsvped && styles.rsvpButtonTextActive]}>
            {isRsvped ? "You're going (not saved)" : 'RSVP (not saved)'}
          </Text>
        </TouchableOpacity>

        {isRsvped && (
          <View style={styles.qrBox}>
            <Text style={styles.qrPlaceholder}>▦ ▦ ▦</Text>
            <Text style={styles.qrNote}>Placeholder — not a real QR code.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    margin: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  rsvpButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  rsvpButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  rsvpButtonText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  rsvpButtonTextActive: {
    color: Colors.white,
  },
  qrBox: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  qrPlaceholder: {
    fontSize: 32,
    letterSpacing: 4,
  },
  qrNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
