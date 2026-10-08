import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import LoadingSkeleton from '../../src/components/LoadingSkeleton';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

interface TimetableEntry {
  _id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location?: string;
}

interface Unit {
  _id: string;
  code: string;
  name: string;
  credits?: number;
}

export default function CourseDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isLecturer = user?.role === 'lecturer' || user?.role === 'admin';

  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [dayOfWeek, setDayOfWeek] =
    useState<(typeof DAYS)[number]>('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        loadingTimetable: {
    marginTop: Spacing.sm,
  },
  loadingTimetableGap: {
    marginTop: Spacing.sm,
  },

  container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        courseHeader: {
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.md,
        },
        courseCode: {
          fontSize: 13,
          fontWeight: '800',
          color: colors.primary,
          textTransform: 'uppercase',
        },
        courseTitle: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
          marginTop: 4,
        },
        sectionHeader: {
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.lg,
          marginBottom: Spacing.xs,
        },
        timetableWrap: {
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        },
        timetableHeaderRow: {
          flexDirection: 'row',
          backgroundColor: colors.primary,
        },
        timetableTimeHeader: {
          width: 82,
          minHeight: 46,
          justifyContent: 'center',
          paddingHorizontal: 6,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        timetableDayHeader: {
          flex: 1,
          minWidth: 72,
          minHeight: 46,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        timetableHeaderText: {
          fontSize: 11,
          fontWeight: '800',
          color: colors.white,
          textAlign: 'center',
        },
        timetableRow: {
          flexDirection: 'row',
          minHeight: 96,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        timetableTimeCell: {
          width: 82,
          justifyContent: 'center',
          paddingHorizontal: 6,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          backgroundColor: colors.background,
        },
        timetableTimeText: {
          fontSize: 11,
          fontWeight: '800',
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 16,
        },
        timetableClassCell: {
          flex: 1,
          minWidth: 72,
          padding: 5,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          justifyContent: 'center',
        },
        timetableClass: {
          flex: 1,
          justifyContent: 'center',
          padding: 6,
          borderRadius: Radius.sm,
          backgroundColor: colors.primary,
        },
        timetableClassTime: {
          fontSize: 9,
          fontWeight: '700',
          color: colors.white,
          marginBottom: 2,
        },
        timetableClassLocation: {
          fontSize: 10,
          color: colors.white,
          fontWeight: '600',
        },
        timetableEmpty: {
          flex: 1,
          minHeight: 84,
          alignItems: 'center',
          justifyContent: 'center',
        },
        timetableEmptyDot: {
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
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
        unitCode: {
          fontSize: 12,
          fontWeight: '800',
          color: colors.primary,
          textTransform: 'uppercase',
        },
        unitName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginTop: 3,
        },
        unitCredits: {
          fontSize: 12,
          color: colors.textMuted,
          marginTop: 3,
        },
        linkCard: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        linkCardTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
        },
        linkCardChevron: {
          fontSize: 18,
          color: colors.textMuted,
        },
        emptyCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        emptyText: {
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 20,
        },
        addButton: {
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.primary,
          borderStyle: 'dashed',
          alignItems: 'center',
        },
        addButtonText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 13,
        },
        formCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        formLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
          marginTop: Spacing.sm,
          marginBottom: 4,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          fontSize: 14,
          color: colors.text,
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
          borderColor: colors.border,
        },
        dayChipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dayChipText: {
          fontSize: 12,
          color: colors.text,
        },
        dayChipTextActive: {
          color: colors.white,
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
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: '600',
        },
        saveButton: {
          backgroundColor: colors.primary,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.sm,
        },
        saveButtonText: {
          color: colors.white,
          fontSize: 13,
          fontWeight: '700',
        },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);

    try {
      const [courseRes, timetableRes, unitsRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get(`/courses/${id}/timetable`),
        api.get(`/courses/${id}/units`),
      ]);

      const course = courseRes.data?.data;

      setCourseTitle(course?.title ?? null);
      setCourseCode(course?.code ?? null);
      setTimetable(
        Array.isArray(timetableRes.data?.data)
          ? timetableRes.data.data
          : []
      );
      setUnits(
        Array.isArray(unitsRes.data?.data)
          ? unitsRes.data.data
          : []
      );
    } catch (err) {
      /*
       * Keep the screen usable when one academic resource fails.
       * Individual sections display their current state rather than
       * inventing content.
       */
      try {
        const [courseRes, timetableRes] = await Promise.all([
          api.get(`/courses/${id}`),
          api.get(`/courses/${id}/timetable`),
        ]);

        const course = courseRes.data?.data;

        setCourseTitle(course?.title ?? null);
        setCourseCode(course?.code ?? null);
        setTimetable(
          Array.isArray(timetableRes.data?.data)
            ? timetableRes.data.data
            : []
        );
      } catch {
        // Leave the existing screen state intact.
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddEntry = async () => {
    if (!startTime.trim() || !endTime.trim()) {
      Alert.alert(
        'Missing info',
        'Start and end time are required, e.g. 07:00 and 09:00.'
      );
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
      await load();
    } catch (err: any) {
      Alert.alert(
        'Could not add entry',
        err?.response?.data?.message || 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    {
      key: 'notes',
      title: 'Notes',
      route: `/course/${id}/notes`,
    },
    {
      key: 'assignment',
      title: 'Assignments',
      route: `/course/${id}/assignments`,
    },
    {
      key: 'cat',
      title: 'CATs',
      route: `/course/${id}/cats`,
    },
    {
      key: 'paper',
      title: 'Past Papers',
      route: `/course/${id}/past-papers`,
    },
    {
      key: 'discussion',
      title: 'Discussion',
      route: `/discussion/${id}`,
    },
  ] as const;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.courseHeader}>
        {courseCode ? (
          <Text style={styles.courseCode}>{courseCode}</Text>
        ) : null}

        <Text style={styles.courseTitle}>
          {courseTitle || 'Course'}
        </Text>
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Timetable
      </Text>

      {isLoading ? (
        <View style={styles.loadingTimetable}>
          <LoadingSkeleton
            width="100%"
            height={64}
            radius={Radius.md}
          />
          <LoadingSkeleton
            width="88%"
            height={64}
            radius={Radius.md}
            style={styles.loadingTimetableGap}
          />
        </View>
      ) : timetable.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No timetable entries yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.md }}
        >
          <View style={styles.timetableWrap}>
            <View style={styles.timetableHeaderRow}>
              <View style={styles.timetableTimeHeader}>
                <Text style={styles.timetableHeaderText}>TIME</Text>
              </View>

              {DAYS.slice(0, 5).map((day) => (
                <View key={day} style={styles.timetableDayHeader}>
                  <Text style={styles.timetableHeaderText}>
                    {day.slice(0, 3).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>

            {[
              ['07:00', '10:00'],
              ['10:00', '13:00'],
              ['13:00', '16:00'],
              ['16:00', '19:00'],
            ].map(([slotStart, slotEnd]) => (
              <View
                key={`${slotStart}-${slotEnd}`}
                style={styles.timetableRow}
              >
                <View style={styles.timetableTimeCell}>
                  <Text style={styles.timetableTimeText}>
                    {slotStart}
                  </Text>
                  <Text style={styles.timetableTimeText}>
                    {slotEnd}
                  </Text>
                </View>

                {DAYS.slice(0, 5).map((day) => {
                  const entry = timetable.find(
                    (item) =>
                      item.dayOfWeek === day &&
                      item.startTime === slotStart
                  );

                  return (
                    <View
                      key={`${day}-${slotStart}`}
                      style={styles.timetableClassCell}
                    >
                      {entry ? (
                        <View
                          style={styles.timetableClass}
                          accessible
                          accessibilityLabel={`${entry.dayOfWeek}, ${entry.startTime} to ${entry.endTime}${
                            entry.location
                              ? ', ' + entry.location
                              : ''
                          }`}
                        >
                          <Text style={styles.timetableClassTime}>
                            {entry.startTime}–{entry.endTime}
                          </Text>

                          {entry.location ? (
                            <Text
                              style={styles.timetableClassLocation}
                              numberOfLines={3}
                            >
                              {entry.location}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.timetableEmpty}>
                          <View style={styles.timetableEmptyDot} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {isLecturer ? (
        <>
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formLabel} accessibilityRole="header">
                Day
              </Text>

              <View
                style={styles.dayRow}
                accessibilityRole="radiogroup"
              >
                {DAYS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayChip,
                      dayOfWeek === d && styles.dayChipActive,
                    ]}
                    onPress={() => setDayOfWeek(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: dayOfWeek === d }}
                    accessibilityLabel={d}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        dayOfWeek === d && styles.dayChipTextActive,
                      ]}
                    >
                      {d.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>
                Start time (24hr, e.g. 07:00)
              </Text>

              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="07:00"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Start time, 24 hour format, example 07:00"
              />

              <Text style={styles.formLabel}>
                End time
              </Text>

              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="09:00"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="End time"
              />

              <Text style={styles.formLabel}>
                Location (optional)
              </Text>

              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Room 12, Block B"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Location, optional"
              />

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowForm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelButtonText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  disabled={isSaving}
                  onPress={handleAddEntry}
                  accessibilityRole="button"
                  accessibilityLabel="Add entry"
                  accessibilityState={{
                    disabled: isSaving,
                    busy: isSaving,
                  }}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving…' : 'Add entry'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowForm(true)}
              accessibilityRole="button"
              accessibilityLabel="Add class to timetable"
            >
              <Text style={styles.addButtonText}>
                + Add class to timetable
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Units
      </Text>

      {units.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No units have been assigned to this course yet.
          </Text>
        </View>
      ) : (
        units.map((unit) => (
          <View
            key={unit._id}
            style={styles.card}
            accessible
            accessibilityLabel={`${unit.code}, ${unit.name}${
              unit.credits ? `, ${unit.credits} credits` : ''
            }`}
          >
            <Text style={styles.unitCode}>
              {unit.code}
            </Text>

            <Text style={styles.unitName}>
              {unit.name}
            </Text>

            {unit.credits ? (
              <Text style={styles.unitCredits}>
                {unit.credits} credits
              </Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Course Tools
      </Text>

      {sections.map((section) => (
        <TouchableOpacity
          key={section.key}
          style={styles.linkCard}
          onPress={() => router.push(section.route as any)}
          accessibilityRole="button"
          accessibilityLabel={section.title}
        >
          <Text style={styles.linkCardTitle}>
            {section.title}
          </Text>

          <Text
            style={styles.linkCardChevron}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ›
          </Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}
