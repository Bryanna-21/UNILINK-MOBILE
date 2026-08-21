import { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

const POLL_INTERVAL_MS = 4000;

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export default function ChatDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: {
          textAlign: 'center',
          color: colors.textMuted,
          marginTop: Spacing.xl,
          paddingHorizontal: Spacing.lg,
        },
        bubble: { borderRadius: Radius.md, padding: Spacing.md, maxWidth: '80%' },
        bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
        bubbleTheirs: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        },
        bubbleText: { color: colors.text, fontSize: 14 },
        bubbleTextMine: { color: colors.white },
        composer: {
          flexDirection: 'row',
          padding: Spacing.md,
          gap: Spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'flex-end',
        },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          fontSize: 14,
          color: colors.text,
          maxHeight: 100,
        },
        sendButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          justifyContent: 'center',
        },
        sendButtonDisabled: { opacity: 0.5 },
        sendButtonText: { color: colors.white, fontWeight: '700' },
      }),
    [colors]
  );

  const loadMessages = async (showSpinner = false) => {
    if (!id) return;
    if (showSpinner) setIsLoading(true);
    try {
      const res = await api.get(`/messages/${id}/messages`);
      setMessages(res.data?.data || []);
      setError(null);
    } catch (err: any) {
      if (messages.length === 0) {
        setError(err?.response?.data?.message || 'Could not load this conversation.');
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
      pollRef.current = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [id])
  );

  const handleSend = async () => {
    if (!draft.trim() || isSending || !id) return;
    const text = draft.trim();
    setDraft('');
    setIsSending(true);
    try {
      await api.post(`/messages/${id}/messages`, { text });
      loadMessages(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send that message.');
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBanner
        status="real"
        note="Messages are real and saved on the backend, but this screen checks for new ones every few seconds rather than receiving them instantly — there's no live push layer yet."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Say hello.</Text>}
          renderItem={({ item }) => {
            const isMine = item.senderId === currentUserId;
            return (
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
        >
          {isSending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
