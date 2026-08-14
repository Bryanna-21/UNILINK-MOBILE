import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: LIVE — events are fetched from GET /api/events on the real
// backend. RSVP and QR check-in also exist on the backend
// (POST /api/events/:id/rsvp, POST /api/events/check-in) but aren't
// wired into the UI yet — that's still open, not claimed as done here.
// Calendar sync & reminders: needs expo-calendar + reminder scheduling.
// Genuinely not built — noted below rather than silently dropped.

interface EventItem {
  _id: string;
  title: string;
  date?: string;
  location?: string;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Text style={styles.title}>Events</Text>
      <StatusBanner status="real" note="Events are fetched live from your account." />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={Colors.primary} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: 0,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  noteBox: {
    margin: Spacing.md,
    padding: Spacing.md,
  },
  noteText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  spinner: {
    marginTop: Spacing.xl,
  },
  cardMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
