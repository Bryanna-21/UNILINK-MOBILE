import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — was a shell linking nowhere; now links into real
// screens built in a later session (user directory, admin
// management, unit catalog, university creation). Audit log viewing
// is deliberately not included: no GET endpoint to read AuditLog
// entries exists anywhere in this backend — the write side (every
// admin action logs one) is real, but nothing reads them back yet.

const LINKS = [
  { key: 'users', title: 'Users', desc: 'Browse every user, any role.', path: '/admin/users' },
  { key: 'admins', title: 'Admin Management', desc: 'Create, edit, and remove administrator accounts.', path: '/admin/admins' },
  { key: 'units', title: 'Unit Catalog', desc: 'Manage the units lecturers can attach to courses.', path: '/admin/units' },
  { key: 'universities', title: 'Universities', desc: 'Register a new university.', path: '/admin/universities' },
  { key: 'campuses', title: 'Campuses', desc: 'Manage the campuses of each university.', path: '/admin/campuses' },
  { key: 'faculties', title: 'Faculties', desc: 'Manage the faculties of each university.', path: '/admin/faculties' },
  { key: 'departments', title: 'Departments', desc: 'Manage the departments of each faculty.', path: '/admin/departments' },
  { key: 'reports', title: 'Emergency Reports', desc: 'Review, respond to, escalate, resolve, or dismiss reports.', path: '/admin/reports' },
] as const;

export default function AdminDashboardScreen() {
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
        Admin
      </Text>
      <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'there'} 👋</Text>

      <StatusBanner status="real" note="User directory, admin management, unit catalog, and university structure are all live." />

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
