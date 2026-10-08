import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Animated } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

const POLL_INTERVAL_MS = 4000;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'https://unilink-backend-1.onrender.com/api';

const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  readBy: string[];
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
  const [conversationType, setConversationType] = useState<
    'direct' | 'course' | 'group' | 'self' | null
  >(null);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingOpacity = useRef(new Animated.Value(0.35)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        chatHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 64,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        backButton: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: Spacing.xs,
        },
        backButtonText: {
          color: colors.text,
          fontSize: 28,
          lineHeight: 30,
          fontWeight: '400',
        },
        chatHeaderAvatar: {
          width: 42,
          height: 42,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: Spacing.sm,
        },
        chatHeaderAvatarText: {
          color: colors.white,
          fontSize: 17,
          fontWeight: '900',
        },
        chatHeaderText: {
          flex: 1,
        },
        chatHeaderTitle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '800',
        },
        chatHeaderSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 2,
        },
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
        seenText: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 2, marginRight: 4 },
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
        typingRow: {
          paddingHorizontal: Spacing.md,
          paddingBottom: Spacing.xs,
          backgroundColor: colors.surface,
        },
        typingBubble: {
          alignSelf: 'flex-start',
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
        },
        typingDots: {
          color: colors.textMuted,
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: 2,
        },
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

  // Fetched once per screen visit, not on every poll — a
  // conversation's type and participants don't change while you're
  // sitting in the chat, so there's no reason to re-fetch this on
  // the same 4s cadence as messages.
  const loadConversationInfo = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/messages/${id}/info`);
      const info = res.data?.data;
      setConversationType(info?.type ?? null);

      if (info?.type === 'direct' && Array.isArray(info.participantIds)) {
        const other = info.participantIds.find((pid: string) => pid !== currentUserId);
        setOtherParticipantId(other ?? null);
      } else {
        setOtherParticipantId(null);
      }
    } catch {
      // Non-fatal: read receipts simply won't show if this fails,
      // the chat itself still works via loadMessages independently.
    }
  }, [id, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      loadConversationInfo();
      loadMessages(true);
      pollRef.current = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);

      const connectRealtime = async () => {
        if (!id) return;

        const token = await SecureStore.getItemAsync('unilink_token');

        if (cancelled || !token) return;

        const socket = io(SOCKET_BASE_URL, {
          auth: { token },
          transports: ['websocket'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('conversation:join', id);
        });

        socket.on('typing:start', (payload: { conversationId?: string; userId?: string }) => {
          if (
            String(payload?.conversationId) === String(id) &&
            String(payload?.userId) !== String(currentUserId)
          ) {
            setIsOtherTyping(true);
          }
        });

        socket.on('typing:stop', (payload: { conversationId?: string; userId?: string }) => {
          if (
            String(payload?.conversationId) === String(id) &&
            String(payload?.userId) !== String(currentUserId)
          ) {
            setIsOtherTyping(false);
          }
        });
      };

      connectRealtime();

      return () => {
        cancelled = true;

        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        if (typingStopTimerRef.current) {
          clearTimeout(typingStopTimerRef.current);
          typingStopTimerRef.current = null;
        }

        if (socketRef.current) {
          socketRef.current.emit('typing:stop', id);
          socketRef.current.emit('conversation:leave', id);
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        setIsOtherTyping(false);
      };
    }, [id, loadConversationInfo, currentUserId])
  );

  const handleSend = async () => {
    if (!draft.trim() || isSending || !id) return;
    const text = draft.trim();

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    socketRef.current?.emit('typing:stop', id);
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

  useEffect(() => {
    if (!isOtherTyping) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(typingOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(typingOpacity, {
          toValue: 0.35,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isOtherTyping, typingOpacity]);

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (!id || !socketRef.current?.connected) return;

    if (!value.trim()) {
      socketRef.current.emit('typing:stop', id);

      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }

      return;
    }

    socketRef.current.emit('typing:start', id);

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', id);
      typingStopTimerRef.current = null;
    }, 1200);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to Messages"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        {conversationType === 'self' ? (
          <>
          <View style={styles.chatHeaderAvatar} accessibilityElementsHidden>
            <Text style={styles.chatHeaderAvatarText}>S</Text>
          </View>

          <View style={styles.chatHeaderText}>
            <Text style={styles.chatHeaderTitle}>Saved Messages</Text>
            <Text style={styles.chatHeaderSubtitle}>
              Private notes and messages to yourself
            </Text>
          </View>
          </>
        ) : (
          <View style={styles.chatHeaderText}>
            <Text style={styles.chatHeaderTitle}>Conversation</Text>
            <Text style={styles.chatHeaderSubtitle}>Messages</Text>
          </View>
        )}
      </View>

      <StatusBanner
        status="real"
        note="Messages are saved on the backend. New messages use a short polling fallback, while typing indicators update live."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          style={{ flex: 1 }}
          contentContainerStyle={[
            {
              padding: Spacing.md,
              paddingBottom: Spacing.xl,
              gap: Spacing.sm,
              flexGrow: 1,
              justifyContent: 'flex-start',
            },
            messages.length === 0 && {
              justifyContent: 'center',
            },
          ]}
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              No messages yet. Say hello.
            </Text>
          }
          renderItem={({ item, index }) => {
            const isMine = item.senderId === currentUserId;
            // Only the LAST message you sent gets a receipt shown —
            // matches standard chat-app convention (WhatsApp,
            // iMessage), avoids a "Seen" label under every single
            // past message you've sent, which would be clutter and
            // also redundant (if the newest is seen, the ones before
            // it necessarily are too, since messages are read in
            // order via getMessages' bulk markAsRead).
            const isLastMineMessage =
              isMine && index === messages.map((m) => m.senderId).lastIndexOf(currentUserId);
            const isSeen =
              conversationType === 'direct' &&
              !!otherParticipantId &&
              item.readBy?.includes(otherParticipantId);
            return (
              <View>
                <View
                  style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                  accessibilityLabel={`${isMine ? 'You' : 'Them'}: ${item.text}`}
                >
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
                </View>
                {isLastMineMessage && isSeen ? (
                  <Text style={styles.seenText} accessibilityLabel="Seen">
                    Seen
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {isOtherTyping ? (
        <View style={styles.typingRow} accessibilityLabel="The other person is typing">
          <View style={styles.typingBubble}>
            <Animated.Text style={[styles.typingDots, { opacity: typingOpacity }]}>
              •••
            </Animated.Text>
          </View>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={handleDraftChange}
          multiline
          accessibilityLabel="Message"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isSending}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !draft.trim() || isSending, busy: isSending }}
        >
          {isSending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
