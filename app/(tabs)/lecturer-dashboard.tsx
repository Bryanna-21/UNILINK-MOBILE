import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — was a shell linking nowhere; now links into real
// screens built in a later session (courses, exams, grading,
// announcements). CATs, attendance, and timetable management are
// deliberately not included here yet — kept out of that session's
// scope, still real gaps on this dashboard.

const LINKS = [
  { key: 'courses', title: 'My Courses', desc: 'Roster, units, and assignments per course.', path: '/lecturer/courses' },
  { key: 'exams', title: 'Exams', desc: 'Create, edit, publish, and manage exams.', path: '/lecturer/exams' },
  { key: 'submissions', title: 'Grade Submissions', desc: 'Grade exam submissions across all your exams.', path: '/lecturer/submissions' },
  { key: 'announcements', title: 'Announcements', desc: 'Post announcements to your students.', path: '/lecturer/announcements' },
  { key: 'timetable', title: 'School Timetable', desc: 'Read the timetable your admin published, comment, and approve or object.', path: '/lecturer/timetables' },
  { key: 'reports', title: 'Emergency Reports', desc: 'Review, respond to, and escalate reports for your courses.', path: '/lecturer/reports' },
] as const;

export default function LecturerDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const colors = useColors();

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
        greeting: { fontSize: 14, color: colors.textMuted, paddingHorizontal: Spacing.md, marginTop: 4 },
        list: { padding: Spacing.md, gap: Spacing.sm },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
        },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        cardDesc: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Lecturer
      </Text>
      <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'there'} 👋</Text>

      <StatusBanner status="real" note="Courses, exams, grading, and announcements are all live." />

      <View style={styles.list}>
        {LINKS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() => router.push(item.path as any)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
