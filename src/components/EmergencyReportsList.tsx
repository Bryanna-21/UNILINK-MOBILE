import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { StatusBanner } from './StatusBanner';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL — GET /api/emergency/reports calls the live backend.
// Shape differs by role, both confirmed directly against
// emergency.controller.js's getAuthorizedReports:
//   - admin: raw EmergencyReport documents, full fields, scoped to
//     their own university
//   - lecturer: toLecturerPreview() only — type/status/priority/
//     courseId/location/assignedTo/createdAt. message is
//     DELIBERATELY withheld at list level; opening a report calls
//     acknowledge (idempotent once already acknowledged) to safely
//     fetch the full document, since no GET /reports/:id exists.
// "abuse"-type reports never appear for a lecturer at all, by
// design (RESTRICTED_TYPES) — this list will simply be shorter for
// them than for an admin at the same university, not an error.

type ReportStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESPONDING' | 'ESCALATED' | 'RESOLVED' | 'DISMISSED';

interface ReportListItem {
  _id: string;
  type: string;
  status: ReportStatus;
  priority?: string;
  location?: string;
  createdAt: string;
  message?: string; // present for admin, absent for lecturer's preview shape
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EmergencyReportsList({ basePath }: { basePath: '/lecturer/report' | '/admin/report' }) {
  const colors = useColors();
  const styles = useStyles(colors);
  const role = useAuthStore((s) => s.user?.role);

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/emergency/reports');
      setReports(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load reports.');
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

  const filtered = useMemo(
    () => (filter === 'all' ? reports : reports.filter((r) => r.status !== 'RESOLVED' && r.status !== 'DISMISSED')),
    [reports, filter]
  );

  const statusColor = (status: ReportStatus) => {
    if (status === 'ESCALATED') return colors.danger;
    if (status === 'RESOLVED' || status === 'DISMISSED') return colors.textMuted;
    return colors.primary;
  };

  const renderItem = ({ item }: { item: ReportListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`${basePath}/${item._id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${item.type} report, status ${item.status}${item.location ? `, at ${item.location}` : ''}, ${formatDate(item.createdAt)}`}
      accessibilityHint="Opens report details"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.typeLabel}>{item.type}</Text>
        <View style={[styles.statusPill, { borderColor: statusColor(item.status) }]}>
          <Text style={[styles.statusPillText, { color: statusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>
      {!!item.message && <Text style={styles.message} numberOfLines={2}>{item.message}</Text>}
      {!!item.location && <Text style={styles.meta}>📍 {item.location}</Text>}
      <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={filtered}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
      ListHeaderComponent={
        <>
          <Text style={styles.title} accessibilityRole="header">
            Emergency Reports
          </Text>
          <StatusBanner
            status="real"
            note={
              role === 'lecturer'
                ? 'Reports for your courses, plus campus-wide ones. Restricted (abuse) reports never appear here.'
                : 'Every report at your university, full detail.'
            }
          />
          {loadError && <Text style={styles.errorText}>{loadError}</Text>}
          <View style={styles.filterRow}>
            {(['active', 'all'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterButton, filter === f && styles.filterButtonActive]}
                onPress={() => setFilter(f)}
                accessibilityRole="radio"
                accessibilityState={{ checked: filter === f }}
                accessibilityLabel={f === 'active' ? 'Show active reports' : 'Show all reports'}
              >
                <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
                  {f === 'active' ? 'Active' : 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      ListEmptyComponent={
        !loadError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reports.</Text>
          </View>
        ) : null
      }
    />
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
        listContent: { padding: Spacing.md, gap: Spacing.sm },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        filterButton: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
        filterButtonText: { fontSize: 12, color: colors.text },
        filterButtonTextActive: { color: colors.white, fontWeight: '700' },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        typeLabel: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
        statusPill: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        statusPillText: { fontSize: 11, fontWeight: '700' },
        message: { fontSize: 13, color: colors.text, marginTop: 4 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
      }),
    [colors]
  );
}
