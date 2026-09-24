import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal, FlatList } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../../../src/api/client';
import { StatusBanner } from '../../../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../../../src/constants/theme';

// STATUS: REAL — GET /api/courses/:id, /:courseId/students,
// /:courseId/units, /:courseId/assignments all call the live backend.
//
// getStudentsForCourse was fixed today: it previously only checked
// enrolledStudentIds, which meant the course's own lecturer was
// rejected with "you must be enrolled" — course.lecturerId was never
// consulted. Now allows the course's lecturer and any admin through
// too. See course.controller.js's own comment on that function.
//
// units here means the global Unit catalog (code/name/credits,
// superadmin-managed) that this course references via
// Course.unitIds — NOT a per-course syllabus section. Both
// getUnitsForCourse (list) and attachUnit (attach) were fixed today:
// the original code queried/created against Unit fields that don't
// exist on that schema (courseId/title/order — the real fields are
// code/name/credits). The catalog-browse modal below calls
// GET /courses/units/catalog, a lecturer/admin-facing endpoint added
// today specifically because GET /admin/units is superadmin-only.

interface CourseDetail {
  _id: string;
  title: string;
  code: string;
  description?: string;
  enrolledStudentIds: string[];
}

interface Student {
  _id: string;
  name: string;
  role: string;
}

interface Unit {
  _id: string;
  code: string;
  name: string;
  credits: number;
}

interface Assignment {
  _id: string;
  title: string;
  dueDate?: string;
  maxScore: number;
}

function formatDate(iso?: string) {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LecturerCourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [catalogUnits, setCatalogUnits] = useState<Unit[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const [courseRes, studentsRes, unitsRes, assignmentsRes] = await Promise.all([
          api.get(`/courses/${id}`),
          api.get(`/courses/${id}/students`).catch(() => ({ data: { data: [] } })),
          api.get(`/courses/${id}/units`),
          api.get(`/courses/${id}/assignments`),
        ]);
        setCourse(courseRes.data?.data ?? null);
        setStudents(studentsRes.data?.data ?? []);
        setUnits(unitsRes.data?.data ?? []);
        setAssignments(assignmentsRes.data?.data ?? []);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || 'Could not load this course.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAttachModal = async () => {
    setAttachModalVisible(true);
    setCatalogLoading(true);
    try {
      // Lecturer-facing catalog browse — GET /admin/units is
      // superadmin-only, so a dedicated, narrower endpoint exists
      // for this specific "browse to attach" flow instead.
      const res = await api.get('/courses/units/catalog');
      setCatalogUnits(res.data?.data ?? []);
    } catch {
      setCatalogUnits([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleAttach = async (unitId: string) => {
    setAttachingId(unitId);
    try {
      await api.post(`/courses/${id}/units`, { unitId });
      setAttachModalVisible(false);
      load();
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not attach unit.');
    } finally {
      setAttachingId(null);
    }
  };

  const attachedUnitIds = useMemo(() => new Set(units.map((u) => u._id)), [units]);
  const availableCatalogUnits = useMemo(
    () => catalogUnits.filter((u) => !attachedUnitIds.has(u._id)),
    [catalogUnits, attachedUnitIds]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Course not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <Text style={styles.title} accessibilityRole="header">
        {course.title}
      </Text>
      <Text style={styles.code}>{course.code}</Text>
      {!!course.description && <Text style={styles.description}>{course.description}</Text>}
      <StatusBanner status="real" note="Course roster, units, and assignments from the live backend." />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/lecturer/exams?courseId=${id}` as any)}
        >
          <Text style={styles.actionButtonText}>📝 Exams</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/lecturer/course/${id}/new-assignment` as any)}
        >
          <Text style={styles.actionButtonText}>➕ New Assignment</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Students ({students.length})</Text>
      {students.length === 0 ? (
        <Text style={styles.emptyText}>No students enrolled yet.</Text>
      ) : (
        students.map((s) => (
          <View key={s._id} style={styles.rosterRow}>
            <Text style={styles.rosterName}>{s.name}</Text>
          </View>
        ))
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Units ({units.length})</Text>
        <TouchableOpacity onPress={openAttachModal} accessibilityRole="button" accessibilityLabel="Attach a unit">
          <Text style={styles.sectionAction}>+ Attach</Text>
        </TouchableOpacity>
      </View>
      {units.length === 0 ? (
        <Text style={styles.emptyText}>No units attached yet.</Text>
      ) : (
        units.map((u) => (
          <View key={u._id} style={styles.unitRow}>
            <Text style={styles.unitCode}>{u.code}</Text>
            <Text style={styles.unitName}>{u.name}</Text>
            <Text style={styles.meta}>{u.credits} credits</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionHeader}>Assignments ({assignments.length})</Text>
      {assignments.length === 0 ? (
        <Text style={styles.emptyText}>No assignments posted yet.</Text>
      ) : (
        assignments.map((a) => (
          <TouchableOpacity
            key={a._id}
            style={styles.assignmentRow}
            onPress={() => router.push(`/lecturer/assignment/${a._id}` as any)}
          >
            <Text style={styles.assignmentTitle}>{a.title}</Text>
            <Text style={styles.meta}>Due {formatDate(a.dueDate)} · {a.maxScore} pts</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: Spacing.xl }} />

      <Modal visible={attachModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attach a Unit</Text>
            {catalogLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <FlatList
                data={availableCatalogUnits}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={<Text style={styles.emptyText}>No unattached units available.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.catalogRow}
                    onPress={() => handleAttach(item._id)}
                    disabled={attachingId === item._id}
                  >
                    <Text style={styles.unitCode}>{item.code}</Text>
                    <Text style={styles.unitName}>{item.name}</Text>
                    {attachingId === item._id && <ActivityIndicator size="small" color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setAttachModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
        title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: Spacing.md, paddingHorizontal: Spacing.md },
        code: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingHorizontal: Spacing.md, marginTop: 4 },
        description: { fontSize: 14, color: colors.textMuted, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginHorizontal: Spacing.md, marginTop: Spacing.sm },
        actionsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
        actionButton: {
          flex: 1,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingVertical: Spacing.sm,
          alignItems: 'center',
        },
        actionButtonText: { fontSize: 13, fontWeight: '700', color: colors.text },
        sectionHeader: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
        sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, marginTop: Spacing.lg },
        sectionAction: { fontSize: 13, fontWeight: '700', color: colors.primary },
        emptyText: { fontSize: 13, color: colors.textMuted, paddingHorizontal: Spacing.md },
        rosterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
        rosterName: { fontSize: 14, color: colors.text },
        unitRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
        },
        unitCode: { fontSize: 13, fontWeight: '700', color: colors.primary },
        unitName: { fontSize: 13, color: colors.text, flex: 1 },
        meta: { fontSize: 12, color: colors.textMuted },
        assignmentRow: {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        assignmentTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalCard: {
          backgroundColor: colors.background,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
          padding: Spacing.lg,
          maxHeight: '70%',
        },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
        catalogRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingVertical: Spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        closeButton: { marginTop: Spacing.md, alignItems: 'center', paddingVertical: Spacing.sm },
        closeButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
      }),
    [colors]
  );
}
