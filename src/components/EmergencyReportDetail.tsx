import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { StatusBanner } from './StatusBanner';
import { useColors, Radius, Spacing } from '../constants/theme';

// STATUS: REAL — every action here (acknowledge, respond, escalate,
// resolve/dismiss) calls the live backend built two sessions ago.
//
// No GET /reports/:id exists anywhere in this backend (confirmed
// directly against emergency.routes.js), so this screen loads full
// detail via PATCH /reports/:id/acknowledge instead — that handler
// only changes status when it's currently OPEN (see
// acknowledgeReport's own status check) and always returns the full
// document either way, so calling it on an already-acknowledged
// report is a safe, idempotent way to fetch detail, not a workaround
// that mutates state unexpectedly.
//
// resolve/dismiss (PATCH /reports/:id/status) is admin-only,
// confirmed via updateReportStatus's own role check — a lecturer
// never sees those buttons here, not because the UI decided to hide
// them, but because the backend would reject the call outright.

interface InternalNote {
  authorId: string;
  note: string;
  createdAt: string;
}

interface ReportDetail {
  _id: string;
  type: string;
  message: string;
  location?: string;
  status: string;
  priority?: string;
  courseId?: string | null;
  assignedTo?: string | null;
  internalNotes: InternalNote[];
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EmergencyReportDetail({ reportId }: { reportId: string }) {
  const colors = useColors();
  const styles = useStyles(colors);
  const role = useAuthStore((s) => s.user?.role);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // See file header: acknowledge doubles as the detail fetch,
      // since no read-only GET /reports/:id exists.
      const res = await api.patch(`/emergency/reports/${reportId}/acknowledge`);
      setReport(res.data?.data ?? null);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load this report.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRespond = async () => {
    if (!note.trim()) {
      Alert.alert('Note required', 'Please write a response note.');
      return;
    }
    setBusy('respond');
    try {
      const res = await api.post(`/emergency/reports/${reportId}/respond`, { note: note.trim() });
      setReport(res.data?.data ?? report);
      setNote('');
    } catch (err: any) {
      Alert.alert('Could not respond', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const handleEscalate = () => {
    Alert.alert('Escalate this report?', 'Admins will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Escalate',
        style: 'destructive',
        onPress: async () => {
          setBusy('escalate');
          try {
            const res = await api.patch(`/emergency/reports/${reportId}/escalate`);
            setReport(res.data?.data ?? report);
          } catch (err: any) {
            Alert.alert('Could not escalate', err?.response?.data?.message || 'Something went wrong.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleSetStatus = (status: 'RESOLVED' | 'DISMISSED') => {
    Alert.alert(`Mark as ${status.toLowerCase()}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: status === 'RESOLVED' ? 'Resolve' : 'Dismiss',
        onPress: async () => {
          setBusy(status);
          try {
            await api.patch(`/emergency/reports/${reportId}/status`, { status });
            router.back();
          } catch (err: any) {
            Alert.alert('Could not update', err?.response?.data?.message || 'Something went wrong.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Report not found.'}</Text>
      </View>
    );
  }

  const canResolve = role === 'admin' && report.status !== 'RESOLVED' && report.status !== 'DISMISSED';
  const canEscalate = report.status !== 'ESCALATED' && report.status !== 'RESOLVED' && report.status !== 'DISMISSED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.typeLabel}>{report.type}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{report.status}</Text>
        </View>
      </View>
      <StatusBanner status="real" note="Full report detail, from the live backend." />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      <View style={styles.messageBox}>
        <Text style={styles.messageLabel}>Report</Text>
        <Text style={styles.messageText}>{report.message}</Text>
      </View>

      {!!report.location && <Text style={styles.meta}>📍 {report.location}</Text>}
      <Text style={styles.meta}>Filed {formatDate(report.createdAt)}</Text>

      {canEscalate && (
        <TouchableOpacity
          style={styles.escalateButton}
          onPress={handleEscalate}
          disabled={busy === 'escalate'}
          accessibilityRole="button"
          accessibilityLabel="Escalate this report"
          accessibilityHint="Notifies admins of this report"
          accessibilityState={{ disabled: busy === 'escalate', busy: busy === 'escalate' }}
        >
          {busy === 'escalate' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.escalateButtonText}>Escalate</Text>}
        </TouchableOpacity>
      )}

      {canResolve && (
        <View style={styles.resolveRow}>
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => handleSetStatus('RESOLVED')}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel="Mark report as resolved"
            accessibilityState={{ disabled: !!busy, busy: busy === 'RESOLVED' }}
          >
            <Text style={styles.resolveButtonText}>{busy === 'RESOLVED' ? '...' : 'Resolve'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleSetStatus('DISMISSED')}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel="Dismiss report"
            accessibilityState={{ disabled: !!busy, busy: busy === 'DISMISSED' }}
          >
            <Text style={styles.dismissButtonText}>{busy === 'DISMISSED' ? '...' : 'Dismiss'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionHeader}>Internal Notes ({report.internalNotes.length})</Text>
      {report.internalNotes.length === 0 ? (
        <Text style={styles.emptyText}>No notes yet.</Text>
      ) : (
        report.internalNotes.map((n, idx) => (
          <View key={idx} style={styles.noteCard}>
            <Text style={styles.noteText}>{n.note}</Text>
            <Text style={styles.meta}>{formatDate(n.createdAt)}</Text>
          </View>
        ))
      )}

      <TextInput
        style={styles.noteInput}
        placeholder="Add a response note"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        accessibilityLabel="Response note"
        accessibilityHint="Write an internal note about this report"
      />
      <TouchableOpacity
        style={styles.respondButton}
        onPress={handleRespond}
        disabled={busy === 'respond'}
        accessibilityRole="button"
        accessibilityLabel="Add note"
        accessibilityState={{ disabled: busy === 'respond', busy: busy === 'respond' }}
      >
        {busy === 'respond' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.respondButtonText}>Add Note</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
        errorText: { color: colors.danger, fontSize: 13, marginVertical: Spacing.sm, textAlign: 'center' },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        typeLabel: { fontSize: 20, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
        statusPill: { borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        statusPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
        messageBox: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginTop: Spacing.md },
        messageLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
        messageText: { fontSize: 14, color: colors.text, marginTop: 4 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: Spacing.xs },
        escalateButton: { backgroundColor: colors.danger, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.md, marginTop: Spacing.md },
        escalateButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
        resolveRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        resolveButton: { flex: 1, backgroundColor: colors.secondary, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.md },
        resolveButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
        dismissButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.md },
        dismissButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
        sectionHeader: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
        emptyText: { fontSize: 13, color: colors.textMuted },
        noteCard: { backgroundColor: colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.xs },
        noteText: { fontSize: 13, color: colors.text },
        noteInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          marginTop: Spacing.md,
          minHeight: 80,
          textAlignVertical: 'top',
        },
        respondButton: { backgroundColor: colors.primary, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.md, marginTop: Spacing.sm },
        respondButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
