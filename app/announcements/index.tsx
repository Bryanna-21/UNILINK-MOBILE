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

// STATUS: REAL — GET /api/announcements, POST /api/announcements
// (backend restricts creation to lecturer/admin roles - isStaff check
// in community.controller.js). The create button is hidden for
// students client-side as a UX nicety; the real enforcement is
// server-side, this just avoids showing an action that would 403.

interface Announcement {
  _id: string;
  title: string;
  body: string;
  courseId?: string;
  postedBy: string;
  createdAt: string;
}

export default function AnnouncementsScreen() {
  const currentUser = useAuthStore((s) => s.user);
  const canPost = currentUser?.role === 'lecturer' || currentUser?.role === 'admin';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.post('/announcements', { title: title.trim(), body: body.trim() });
      setAnnouncements((prev) => [res.data.data, ...prev]);
      setTitle('');
      setBody('');
      setCreateOpen(false);
    } catch {
      // keep form open
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Announcements are saved to the real backend." />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Announcements</Text>
        {canPost && (
          <TouchableOpacity style={styles.createButton} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createButtonText}>+ New</Text>
          </TouchableOpacity>
        )}
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
          data={announcements}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No announcements yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, styles.multiline]} placeholder="Body" placeholderTextColor={Colors.textMuted} value={body} onChangeText={setBody} multiline />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmit, (!title.trim() || !body.trim()) && styles.postButtonDisabled]} onPress={handleCreate} disabled={!title.trim() || !body.trim() || isCreating}>
                {isCreating ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Post</Text>}
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
  cardBody: { fontSize: 14, color: Colors.text },
  meta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  postButtonDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.text },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancel: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.text, fontWeight: '600' },
  modalSubmit: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  modalSubmitText: { color: Colors.white, fontWeight: '700' },
});
