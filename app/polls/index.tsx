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

// STATUS: REAL — GET/POST /api/polls, POST /api/polls/:id/vote.
// The backend does not return a separate "did I vote / on what" flag —
// it only returns each option's voterIds array. This screen derives
// the user's current vote by scanning voterIds itself, rather than
// assuming a field that doesn't exist in the response.

interface PollOption {
  text: string;
  voterIds: string[];
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
}

export default function PollsScreen() {
  const colors = useColors();
  const currentUser = useAuthStore((s) => s.user);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '']);
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
          gap: 8,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
        optionRow: { position: 'relative', borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, overflow: 'hidden' },
        optionRowActive: { borderColor: colors.primary },
        // Same '22' hex-alpha-suffix technique as the original — still
        // works correctly since colors.accent resolves to the same hex
        // string in both palettes, this isn't a simple reference swap
        // but the concatenation pattern itself needed no change.
        optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent + '22' },
        optionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
        optionText: { fontSize: 14, color: colors.text, flex: 1 },
        optionTextActive: { fontWeight: '700', color: colors.primary },
        optionPct: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
        voteCount: { fontSize: 12, color: colors.textMuted },
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
        addOptionText: { color: colors.primary, fontWeight: '600', fontSize: 13, paddingVertical: 4 },
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
      const res = await api.get('/polls');
      setPolls(res.data?.data ?? []);
    } catch {
      setLoadError('Could not load polls.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myVoteIndex = (poll: Poll): number | null => {
    if (!currentUser) return null;
    const idx = poll.options.findIndex((o) => o.voterIds.includes(currentUser.id));
    return idx === -1 ? null : idx;
  };

  const totalVotes = (poll: Poll) => poll.options.reduce((sum, o) => sum + o.voterIds.length, 0);

  const handleVote = async (pollId: string, optionIndex: number) => {
    setVotingId(pollId);
    try {
      const res = await api.post(`/polls/${pollId}/vote`, { optionIndex });
      setPolls((prev) => prev.map((p) => (p._id === pollId ? res.data.data : p)));
    } catch {
      // no-op, allow retry
    } finally {
      setVotingId(null);
    }
  };

  const updateOptionInput = (index: number, value: string) => {
    setOptionInputs((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOptionInput = () => setOptionInputs((prev) => [...prev, '']);

  const handleCreate = async () => {
    const cleanOptions = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) return;
    setIsCreating(true);
    try {
      const res = await api.post('/polls', { question: question.trim(), options: cleanOptions });
      setPolls((prev) => [res.data.data, ...prev]);
      setQuestion('');
      setOptionInputs(['', '']);
      setCreateOpen(false);
    } catch {
      // keep form open
    } finally {
      setIsCreating(false);
    }
  };

  const canSubmitCreate = question.trim().length > 0 && optionInputs.map((o) => o.trim()).filter(Boolean).length >= 2;

  return (
    <View style={styles.container}>
      <StatusBanner status="real" note="Polls and votes are saved to the real backend." />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Polls</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setCreateOpen(true)}>
          <Text style={styles.createButtonText}>+ New Poll</Text>
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
          data={polls}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
          ListEmptyComponent={<Text style={styles.emptyText}>No active polls. Ask something.</Text>}
          renderItem={({ item }) => {
            const votedIndex = myVoteIndex(item);
            const total = totalVotes(item);
            const isVoting = votingId === item._id;

            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.question}</Text>

                {item.options.map((option, index) => {
                  const pct = total > 0 ? Math.round((option.voterIds.length / total) * 100) : 0;
                  const isMyVote = votedIndex === index;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.optionRow, isMyVote && styles.optionRowActive]}
                      onPress={() => handleVote(item._id, index)}
                      disabled={isVoting}
                    >
                      <View style={[styles.optionFill, { width: `${pct}%` }]} />
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionText, isMyVote && styles.optionTextActive]}>
                          {option.text} {isMyVote ? '✓' : ''}
                        </Text>
                        <Text style={styles.optionPct}>{pct}%</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.voteCount}>{total} vote{total === 1 ? '' : 's'}</Text>
              </View>
            );
          }}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Poll</Text>
            <TextInput
              style={styles.input}
              placeholder="Question"
              placeholderTextColor={colors.textMuted}
              value={question}
              onChangeText={setQuestion}
            />

            {optionInputs.map((value, index) => (
              <TextInput
                key={index}
                style={styles.input}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={(v) => updateOptionInput(index, v)}
              />
            ))}

            <TouchableOpacity onPress={addOptionInput}>
              <Text style={styles.addOptionText}>+ Add another option</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !canSubmitCreate && styles.postButtonDisabled]}
                onPress={handleCreate}
                disabled={!canSubmitCreate || isCreating}
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
