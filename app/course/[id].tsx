import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: MIXED — course header and Timetable are real (fetch the
// actual course; lecturers can add real timetable entries via POST
// /courses/:courseId/timetable). Assignments and CATs now link to
// real list screens (app/course/[id]/assignments.tsx,
// app/course/[id]/cats.tsx) which link to the real detail/submission/
// grading screens. Discussion links to the real per-course discussion
// feed. Notes, Past Papers, and the AI link still point at placeholder
// ids / an unbuilt route — those three remain genuinely unwired.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

interface TimetableEntry {
  _id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location?: string;
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isLecturer = user?.role === 'lecturer' || user?.role === 'admin';

  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState<(typeof DAYS)[number]>('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [courseRes, timetableRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/courses/${id}/timetable`),
      ]);
      setCourseTitle(courseRes.data?.data?.title ?? null);
      setTimetable(timetableRes.data?.data ?? []);
    } catch {
      // Course fetch failing isn't fatal to the rest of this screen —
      // the placeholder sections below still render regardless.
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddEntry = async () => {
    if (!startTime.trim() || !endTime.trim()) {
      Alert.alert('Missing info', 'Start and end time are required, e.g. 07:00 and 09:00.');
      return;
    }
    setIsSaving(true);
    try {
      await api.post(`/courses/${id}/timetable`, {
        dayOfWeek,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        location: location.trim() || undefined,
      });
      setStartTime('');
      setEndTime('');
      setLocation('');
      setShowForm(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not add entry', err?.response?.data?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { key: 'notes', title: 'Notes', route: `/notes/${id}-note-1`, note: 'Needs: Note model + file storage + PDF viewer library.' },
    { key: 'assignment', title: 'Assignments', route: `/course/${id}/assignments`, note: null },
    { key: 'cat', title: 'CATs', route: `/course/${id}/cats`, note: null },
    { key: 'paper', title: 'Past Papers', route: `/paper/${id}-paper-1`, note: 'Needs: file storage + PastPaper model.' },
    { key: 'discussion', title: 'Discussion', route: `/discussion/${id}`, note: null },
    { key: 'ai', title: 'Ask UNILINK AI', route: '/ai', note: null },
  ] as const;

  return (
    <ScrollView style={styles.container}>
      <StatusBanner
        status="real"
        note={courseTitle ? `${courseTitle} — live course data.` : `Loading course "${id}"…`}
      />

      <Text style={styles.sectionHeader}>Timetable</Text>
      <StatusBanner status="real" note="Lecturers add entries here; students see them on Home." />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.sm }} color={Colors.primary} />
      ) : timetable.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.itemText}>No timetable entries yet.</Text>
        </View>
      ) : (
        timetable.map((entry) => (
          <View key={entry._id} style={styles.card}>
            <Text style={styles.itemText}>
              {entry.dayOfWeek} · {entry.startTime}–{entry.endTime}
            </Text>
            {entry.location ? <Text style={styles.itemSubtext}>{entry.location}</Text> : null}
          </View>
        ))
      )}

      {isLecturer && (
        <>
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Day</Text>
              <View style={styles.dayRow}>
                {DAYS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, dayOfWeek === d && styles.dayChipActive]}
                    onPress={() => setDayOfWeek(d)}
                  >
                    <Text style={[styles.dayChipText, dayOfWeek === d && styles.dayChipTextActive]}>
                      {d.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Start time (24hr, e.g. 07:00)</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="07:00"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.formLabel}>End time</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="09:00"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.formLabel}>Location (optional)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Room 12, Block B"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} disabled={isSaving} onPress={handleAddEntry}>
                  <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Add entry'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>+ Add class to timetable</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <Text style={styles.sectionHeader}>Units</Text>
      <View style={styles.card}>
        <Text style={styles.itemText}>Unit 1 — placeholder</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.itemText}>Unit 2 — placeholder</Text>
      </View>

      <Text style={styles.sectionHeader}>Course Tools</Text>
      {sections.map((s) => (
        <TouchableOpacity key={s.key} style={styles.linkCard} onPress={() => router.push(s.route as any)}>
          <Text style={styles.linkCardTitle}>{s.title}</Text>
          <Text style={styles.linkCardChevron}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  itemText: {
    fontSize: 14,
    color: Colors.text,
  },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  linkCardChevron: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  itemSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  formCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 14,
    color: Colors.text,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dayChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  dayChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  cancelButtonText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
