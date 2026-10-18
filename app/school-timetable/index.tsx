import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL. The school timetables your university's admin has published (GET /school-timetables).
// Lecturers and students have two weeks to comment and approve or object. Open one to read it.
interface Item {
  id: string;
  title: string;
  term: string;
  status: 'published' | 'finalized';
  version: number;
  rows: number;
  myVote: 'approve' | 'object' | null;
  windowOpen: boolean;
  suggestionsCloseAt: string | null;
}

export default function LecturerTimetablesScreen() {
  const colors = useColors();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: Spacing.md, gap: Spacing.sm },
        note: { fontSize: 12, color: colors.textMuted, marginBottom: Spacing.sm },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: Spacing.md },
        empty: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        card: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.sm },
        title: { fontSize: 16, fontWeight: '700', color: colors.text },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
        chip: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, overflow: 'hidden' },
        open: { backgroundColor: colors.primary, color: colors.white },
        final: { backgroundColor: colors.border, color: colors.text },
        voted: { borderWidth: 1, borderColor: colors.border, color: colors.text },
        waiting: { borderWidth: 1, borderColor: colors.danger, color: colors.danger },
      }),
    [colors]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/school-timetables');
      setItems(res.data?.data ?? []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load timetables. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'School Timetable', headerShown: true }} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>Published by your university's administration. Lecturers and students have two weeks to suggest edits and to approve or object.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator color={colors.primary} style={{ marginBottom: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No timetable has been published for discussion yet.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/school-timetable/${item.id}` as any)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.term ? `${item.term} · ` : ''}
              {item.rows} sessions · version {item.version}
            </Text>
            <View style={styles.row}>
              <Text style={[styles.chip, item.windowOpen ? styles.open : styles.final]}>
                {item.windowOpen && item.suggestionsCloseAt ? `OPEN UNTIL ${new Date(item.suggestionsCloseAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}` : item.status === 'published' ? 'WINDOW CLOSED' : 'FINALIZED'}
              </Text>
              {item.windowOpen && (
                <Text style={[styles.chip, item.myVote ? styles.voted : styles.waiting]}>
                  {item.myVote === 'approve' ? 'You approved' : item.myVote === 'object' ? 'You objected' : 'Your vote needed'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
