import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: LIVE — events are fetched from GET /api/events on the real
// backend. RSVP and QR check-in are now BOTH wired into the UI: RSVP
// + real QR display live on the event detail screen
// (app/event/[id].tsx), and lecturers/admins get a "Scan check-in"
// entry point below leading to app/event/scan-checkin.tsx.
// Calendar sync & reminders: needs expo-calendar + reminder scheduling.
// Genuinely not built — noted below rather than silently dropped.

interface EventItem {
  _id: string;
  title: string;
  date?: string;
  location?: string;
}

export default function EventsScreen() {
  const colors = useColors();
  const role = useAuthStore((s) => s.user?.role);
  const isStaff = role === 'lecturer' || role === 'admin';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
          padding: Spacing.md,
          paddingTop: Spacing.xl,
          paddingBottom: 0,
        },
        card: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
        noteBox: { margin: Spacing.md, padding: Spacing.md },
        noteText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
        spinner: { marginTop: Spacing.xl },
        cardMuted: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        scanButton: {
          backgroundColor: colors.primary,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          alignItems: 'center',
        },
        scanButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
      }),
    [colors]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/events');
      setEvents(res.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load events. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
    >
      <Text style={styles.title} accessibilityRole="header">
        Events
      </Text>
      <StatusBanner status="real" note="Events are fetched live from your account." />

      {isStaff && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push('/event/scan-checkin' as any)}
          accessibilityRole="button"
          accessibilityLabel="Scan check-in QR code"
        >
          <Text style={styles.scanButtonText}>📷 Scan Check-in</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardMuted}>{error}</Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardMuted}>No events yet.</Text>
        </View>
      ) : (
        events.map((event) => (
          <TouchableOpacity
            key={event._id}
            style={styles.card}
            onPress={() => router.push(`/event/${event._id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}${event.date ? ', ' + event.date : ''}${event.location ? ', ' + event.location : ''}`}
          >
            <Text style={styles.cardTitle}>{event.title}</Text>
            {event.date ? <Text style={styles.cardMuted}>{event.date}</Text> : null}
            {event.location ? <Text style={styles.cardMuted}>{event.location}</Text> : null}
          </TouchableOpacity>
        ))
      )}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Calendar sync & reminders: needs expo-calendar + reminder scheduling. Not built.
        </Text>
      </View>
    </ScrollView>
  );
}
