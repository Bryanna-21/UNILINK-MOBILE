import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — calls GET /api/messages (conversation list) and
// resolves each conversation's other participant's name via
// GET /api/profile/summary/:userId. Starting a new conversation is a
// separate screen (messages/new.tsx) that uses the course-roster
// endpoint to let a student pick a classmate.
//
// This is REST-only, same as the rest of the messaging backend — no
// socket.io layer for chat yet (see chat/[id].tsx's own note). This
// list itself doesn't need real-time updates as urgently as an open
// chat does, so it simply refetches on screen focus and pull-to-refresh
// rather than polling continuously in the background.

interface Conversation {
  _id: string;
  participantIds: string[];
  lastMessageAt: string;
}

interface ConversationDisplay extends Conversation {
  otherUserName: string;
}

export default function MessagesScreen() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [conversations, setConversations] = useState<ConversationDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async () => {
    try {
      const res = await api.get('/messages');
      const raw: Conversation[] = res.data?.data || [];

      // Resolve a display name for each conversation's other
      // participant. Done in parallel rather than sequentially so N
      // conversations don't cost N round-trips in series.
      const withNames = await Promise.all(
        raw.map(async (conv) => {
          const otherId = conv.participantIds.find((id) => id !== currentUserId) || conv.participantIds[0];
          try {
            const summaryRes = await api.get(`/profile/summary/${otherId}`);
            return { ...conv, otherUserName: summaryRes.data?.data?.name || 'Unknown user' };
          } catch {
            // If a single name lookup fails, don't fail the whole
            // list — show a fallback for just that row.
            return { ...conv, otherUserName: 'Unknown user' };
          }
        })
      );

      setConversations(withNames);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your messages.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [currentUserId])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadConversations();
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.newButton} onPress={() => router.push('/messages/new' as any)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <StatusBanner
        status="real"
        note="Conversations use the live backend. Messages refresh when you open a chat, not instantly in the background — there's no real-time push layer yet."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No conversations yet. Tap "+ New" to message a classmate.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => router.push(`/chat/${item._id}` as any)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatName}>{item.otherUserName}</Text>
              </View>
              <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  newButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  newButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: Colors.danger,
    textAlign: 'center',
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '700',
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});