import { useState, useCallback, useEffect } from 'react';
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
import { Colors, Radius, Spacing } from '../../src/constants/theme';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';

// STATUS: REAL — GET/POST /api/study-groups, POST /api/study-groups/:id/join.
// Note: there is no /leave route for study groups on the backend
// (unlike Clubs) — only join exists. That's a real backend asymmetry,
// not a mobile oversight, so "Leave" isn't offered here.

interface StudyGroup {
  _id: string;
  title: string;
  courseId?: string;
  description?: string;
  meetingTime?: string;
  location?: string;
  ownerId: string;
  memberIds: string[];
}

export default function StudyGroupsScreen() {
  const currentUser = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/study-groups');
      setGroups(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load study groups.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (group: StudyGroup) => {
    setPendingId(group._id);
    try {
      const res = await api.post(`/study-groups/${group._id}/join`);
      setGroups((prev) => prev.map((g) => (g._id === group._id ? res.data.data : g)));
    } catch {
      // no-op, allow retry
    } finally {
      setPendingId(null);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.post('/study-groups', {
        title: title.trim(),
        description: description.trim() || undefined,
        meetingTime: meetingTime.trim() || undefined,
        location: location.trim() || undefined,
      });
      setGroups((prev) => [res.data.data, ...prev]);
      setTitle('');
      setDescription('');
      setMeetingTime('');
      setLocation('');
      setCreateOpen(false);
    } catch {
      // keep form open
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Study groups are saved to the real backend." />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Study Groups</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setCreateOpen(true)}>
          <Text style={styles.createButtonText}>+ New Group</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
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
          data={groups}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No study groups yet. Start one.</Text>}
          renderItem={({ item }) => {
            const isMember = !!currentUser && item.memberIds.includes(currentUser.id);
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!!item.description && <Text style={styles.cardBody}>{item.description}</Text>}
                {!!item.meetingTime && <Text style={styles.meta}>🕒 {item.meetingTime}</Text>}
                {!!item.location && <Text style={styles.meta}>📍 {item.location}</Text>}
                <Text style={styles.memberCount}>
                  {item.memberIds.length} member{item.memberIds.length === 1 ? '' : 's'}
                </Text>

                {!isMember && (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => handleJoin(item)}
                    disabled={pendingId === item._id}
                  >
                    {pendingId === item._id ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.joinButtonText}>Join</Text>
                    )}
                  </TouchableOpacity>
                )}
                {isMember && <Text style={styles.ownerTag}>You're a member</Text>}
              </View>
            );
          }}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Study Group</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, styles.multiline]} placeholder="Description (optional)" placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="Meeting time (optional)" placeholderTextColor={Colors.textMuted} value={meetingTime} onChangeText={setMeetingTime} />
            <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={Colors.textMuted} value={location} onChangeText={setLocation} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmit, !title.trim() && styles.postButtonDisabled]} onPress={handleCreate} disabled={!title.trim() || isCreating}>
                {isCreating ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  createButton: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  createButtonText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl },
  retryButton: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md },
  retryText: { color: Colors.white, fontWeight: '600' },
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardBody: { fontSize: 14, color: Colors.text, marginBottom: 2 },
  meta: { fontSize: 12, color: Colors.textMuted },
  memberCount: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  joinButton: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 8, alignItems: 'center' },
  joinButtonText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  ownerTag: { marginTop: 8, fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  postButtonDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.text },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancel: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.text, fontWeight: '600' },
  modalSubmit: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  modalSubmitText: { color: Colors.white, fontWeight: '700' },
});
