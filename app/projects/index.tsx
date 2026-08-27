import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';

// STATUS: REAL — GET/POST /api/community/projects. No join/leave route exists
// for Projects (unlike Clubs/Study Groups) — contributorIds is set
// from the creator only at creation time on the backend, so this
// screen doesn't offer a join action that doesn't exist server-side.

const STATUSES = ['planning', 'active', 'completed'] as const;
type ProjectStatus = (typeof STATUSES)[number];

interface Project {
  _id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  ownerId: string;
  contributorIds: string[];
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
};

export default function ProjectsScreen() {
  const colors = useColors();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [isCreating, setIsCreating] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.md,
        },
        title: { fontSize: 22, fontWeight: '700', color: colors.text },
        createButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 12 },
        createButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
        emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl },
        retryButton: {
          marginTop: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
        },
        retryText: { color: colors.white, fontWeight: '600' },
        card: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.lg,
          padding: Spacing.md,
          gap: 4,
        },
        cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
        statusBadge: {
          backgroundColor: colors.background,
          borderRadius: Radius.full,
          paddingVertical: 3,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        statusBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
        cardBody: { fontSize: 14, color: colors.text },
        memberCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        postButtonDisabled: { opacity: 0.5 },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
        modalCard: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          padding: Spacing.lg,
          gap: Spacing.sm,
        },
        modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          fontSize: 14,
          color: colors.text,
        },
        multiline: { minHeight: 70, textAlignVertical: 'top' },
        fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
        statusPicker: { flexDirection: 'row', gap: 8 },
        statusOption: {
          flex: 1,
          paddingVertical: 8,
          alignItems: 'center',
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        statusOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        statusOptionText: { fontSize: 12, fontWeight: '600', color: colors.text },
        statusOptionTextActive: { color: colors.white },
        modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        modalCancel: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        modalCancelText: { color: colors.text, fontWeight: '600' },
        modalSubmit: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, backgroundColor: colors.primary },
        modalSubmitText: { color: colors.white, fontWeight: '700' },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/community/projects');
      setProjects(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load projects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.post('/community/projects', {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
      });
      setProjects((prev) => [res.data.data, ...prev]);
      setTitle('');
      setDescription('');
      setStatus('planning');
      setCreateOpen(false);
    } catch {
      // keep form open
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Projects are saved to the real backend." />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Projects</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setCreateOpen(true)}>
          <Text style={styles.createButtonText}>+ New Project</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!isLoading && loadError && (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !loadError && (
        <FlatList
          data={projects}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No projects yet. Start one.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              {!!item.description && <Text style={styles.cardBody}>{item.description}</Text>}
              <Text style={styles.memberCount}>
                {item.contributorIds.length} contributor{item.contributorIds.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusPicker}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, status === s && styles.statusOptionActive]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusOptionText, status === s && styles.statusOptionTextActive]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !title.trim() && styles.postButtonDisabled]}
                onPress={handleCreate}
                disabled={!title.trim() || isCreating}
              >
                {isCreating ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.modalSubmitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
