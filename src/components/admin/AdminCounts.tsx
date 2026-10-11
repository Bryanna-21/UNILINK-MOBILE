import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../api/client';
import { useColors, Radius, Spacing } from '../../constants/theme';

// STATUS: REAL. Counts by role from GET /admin/dashboard-stats (admin and superadmin).
interface Stats {
  totalUsers: number;
  students: number;
  lecturers: number;
  admins: number;
  superadmins: number;
}

export function AdminCounts() {
  const colors = useColors();
  const [stats, setStats] = useState<Stats | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
        tile: {
          flexGrow: 1,
          minWidth: '30%',
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
        },
        value: { fontSize: 22, fontWeight: '800', color: colors.text },
        label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
      }),
    [colors]
  );

  useFocusEffect(
    useCallback(() => {
      api
        .get('/admin/dashboard-stats')
        .then((res) => setStats(res.data?.data ?? null))
        .catch(() => setStats(null));
    }, [])
  );

  if (!stats) return null;
  const tiles: [string, number | undefined][] = [
    ['Total users', stats.totalUsers],
    ['Students', stats.students],
    ['Lecturers', stats.lecturers],
    ['Admins', (stats.admins ?? 0) + (stats.superadmins ?? 0)],
  ];
  return (
    <View style={styles.row}>
      {tiles.map(([label, value]) => (
        <View key={label} style={styles.tile} accessible accessibilityLabel={`${label}: ${value ?? 0}`}>
          <Text style={styles.value}>{value ?? 0}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
