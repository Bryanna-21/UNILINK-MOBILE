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
import { useAuthStore } from '../../src/store/authStore';

interface Club {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
}

export default function ClubsScreen() {
  const colors = useColors();
  const currentUser = useAuthStore((s) => s.user);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
          gap: 6,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardBody: { fontSize: 14, color: colors.text },
        memberCount: { fontSize: 12, color: colors.textMuted },
        joinButton: { marginTop: 8, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 8, alignItems: 'center' },
        leaveButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
        joinButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        leaveButtonText: { color: colors.text },
        ownerTag: { marginTop: 8, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
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
      const res = await api.get('/clubs');
      setClubs(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load clubs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMembership = async (club: Club) => {
    if (!currentUser) return;
    const isMember = club.memberIds.includes(currentUser.id);
    setPendingId(club._id);
    try {
      const res = await api.post(`/clubs/${club._id}/${isMember ? 'leave' : 'join'}`);
      setClubs((prev) => prev.map((c) => (c._id === club._id ? res.data.data : c)));
    } catch {
      // Leave list state as-is on failure; user can retry the tap.
    } finally {
      setPendingId(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.post('/clubs', { name: name.trim(), description: description.trim() || undefined });
      setClubs((prev) => [res.data.data, ...prev]);
      setName('');
      setDescription('');
      setCreateOpen(false);
    } catch {
      // Keep the form open with entered text so nothing is lost.
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Clubs are saved to the real backend." />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Clubs</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setCreateOpen(true)}>
          <Text style={styles.createButtonText}>+ New Club</Text>
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
          data={clubs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No clubs yet. Start one.</Text>}
          renderItem={({ item }) => {
            const isMember = !!currentUser && item.memberIds.includes(currentUser.id);
            const isOwner = item.ownerId === currentUser?.id;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && <Text style={styles.cardBody}>{item.description}</Text>}
                <Text style={styles.memberCount}>
                  {item.memberIds.length} member{item.memberIds.length === 1 ? '' : 's'}
                </Text>

                {!isOwner && (
                  <TouchableOpacity
                    style={[styles.joinButton, isMember && styles.leaveButton]}
                    onPress={() => toggleMembership(item)}
                    disabled={pendingId === item._id}
                  >
                    {pendingId === item._id ? (
                      <ActivityIndicator size="small" color={isMember ? colors.text : colors.white} />
                    ) : (
                      <Text style={[styles.joinButtonText, isMember && styles.leaveButtonText]}>
                        {isMember ? 'Leave' : 'Join'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {isOwner && <Text style={styles.ownerTag}>You own this club</Text>}
              </View>
            );
          }}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Club</Text>
            <TextInput
              style={styles.input}
              placeholder="Club name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !name.trim() && styles.postButtonDisabled]}
                onPress={handleCreate}
                disabled={!name.trim() || isCreating}
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
