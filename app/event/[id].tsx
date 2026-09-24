import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: REAL — was previously a full placeholder: fake event title,
// RSVP that only flipped local state, and a row of "▦ ▦ ▦" characters
// standing in for a QR code. All three are now wired to the live
// backend: GET /api/events/:id for the real event, POST
// /api/events/:id/rsvp to actually create an RSVP, GET
// /api/events/:id/my-rsvp to restore RSVP state on revisit (so
// re-opening this screen after RSVPing doesn't lose the QR), and a
// REAL rendered QR code (react-native-qrcode-svg) encoding the
// backend's qrToken — the same token checkInWithQr verifies against,
// not a fake placeholder or the event/RSVP's raw _id.
//
// Scanning that code is a SEPARATE screen (see
// app/event/scan-checkin.tsx) for lecturers/admins — this screen only
// ever displays a student's own code, it never scans anyone else's.

interface EventDetail {
  _id: string;
  title: string;
  description?: string;
  date: string;
  location?: string;
  capacity?: number;
}

interface RsvpRecord {
  _id: string;
  qrToken: string;
  checkedIn: boolean;
  checkedInAt?: string;
}

export default function EventDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rsvp, setRsvp] = useState<RsvpRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        card: {
          margin: Spacing.md,
          padding: Spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: { fontSize: 20, fontWeight: '800', color: colors.text },
        meta: { fontSize: 13, color: colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
        description: { fontSize: 14, color: colors.text, marginBottom: Spacing.lg },
        rsvpButton: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: Radius.md,
          paddingVertical: Spacing.md,
          alignItems: 'center',
        },
        rsvpButtonActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
        rsvpButtonDisabled: { opacity: 0.6 },
        rsvpButtonText: { color: colors.primary, fontWeight: '700' },
        rsvpButtonTextActive: { color: colors.white },
        qrBox: {
          marginTop: Spacing.lg,
          alignItems: 'center',
          padding: Spacing.lg,
          backgroundColor: colors.white,
          borderRadius: Radius.md,
        },
        qrNote: { fontSize: 11, color: colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
        checkedInBadge: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: Spacing.sm },
        spinner: { marginTop: Spacing.xl },
        errorText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: Spacing.lg },
      }),
    [colors]
  );

  const loadEventAndRsvp = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [eventRes, rsvpRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/my-rsvp`).catch((e) =>
          e?.response?.status === 404 ? { data: { data: null } } : Promise.reject(e)
        ),
      ]);
      setEvent(eventRes.data?.data ?? null);
      setRsvp(rsvpRes.data?.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load this event.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEventAndRsvp();
  }, [loadEventAndRsvp]);

  const handleRsvp = async () => {
    if (!id) return;
    setIsSubmittingRsvp(true);
    try {
      const res = await api.post(`/events/${id}/rsvp`);
      setRsvp(res.data?.data ?? null);
    } catch (err: any) {
      Alert.alert('Could not RSVP', err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.errorText}>{error || 'Event not found.'}</Text>
      </ScrollView>
    );
  }

  const eventDate = new Date(event.date);
  const dateLabel = Number.isNaN(eventDate.getTime())
    ? event.date
    : eventDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ScrollView style={styles.container}>
      <StatusBanner status="real" note="Event details, RSVP, and your check-in QR code are all live." />

      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          {event.title}
        </Text>
        <Text style={styles.meta}>
          {dateLabel}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

        <TouchableOpacity
          style={[styles.rsvpButton, rsvp && styles.rsvpButtonActive, isSubmittingRsvp && styles.rsvpButtonDisabled]}
          onPress={handleRsvp}
          disabled={!!rsvp || isSubmittingRsvp}
          accessibilityRole="button"
          accessibilityLabel={rsvp ? "You're going to this event" : 'RSVP to this event'}
          accessibilityState={{ selected: !!rsvp, disabled: !!rsvp || isSubmittingRsvp }}
        >
          {isSubmittingRsvp ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.rsvpButtonText, rsvp && styles.rsvpButtonTextActive]}>
              {rsvp ? "You're going" : 'RSVP'}
            </Text>
          )}
        </TouchableOpacity>

        {rsvp && (
          <View style={styles.qrBox}>
            <QRCode value={rsvp.qrToken} size={180} />
            {rsvp.checkedIn ? (
              <Text style={styles.checkedInBadge}>✓ Checked in</Text>
            ) : (
              <Text style={styles.qrNote}>Show this code at the door to check in.</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
