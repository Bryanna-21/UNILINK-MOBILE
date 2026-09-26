import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore, UserRole } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — matches web's src/pages/Messages.js and
// src/services/messageService.js exactly, both read directly rather
// than inferred. This is a genuine three-type model (direct, course,
// group), not the flat direct-only shape this file previously used —
// that older version would have silently mis-rendered or crashed on
// any course/group conversation, since it never declared a `type`
// field at all. Confirmed by reading messageService.js's own header
// comment: a prior version of that file described a much larger,
// speculative API that was never real; this one only includes
// curl-verified endpoints.
//
// Deliberately NOT built here: starting a new course or group
// conversation. messages/new.tsx only supports picking a classmate
// for a direct message — creating a group (with a title) or joining a
// course conversation is a distinct, larger feature that needs its
// own screen and is intentionally left as a follow-up rather than
// folded into this pass.

type ConversationType = 'direct' | 'course' | 'group';

interface Conversation {
  _id: string;
  type: ConversationType;
  participantIds: string[];
  title?: string;
  unreadCount?: number;
  lastMessageAt: string;
  lastMessage?: {
    senderId: string;
    preview: string;
    createdAt: string;
  } | null;
  isPinned?: boolean;
}

const TABS = ['Messages', 'Unread', 'Communities', 'Lecturers'] as const;
type Tab = (typeof TABS)[number];

export default function MessagesScreen() {
  const colors = useColors();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('Messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [participantRoles, setParticipantRoles] = useState<Record<string, UserRole>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
        },
        title: { fontSize: 24, fontWeight: '800', color: colors.text },
        newButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
        },
        newButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
        tabRow: {
          flexDirection: 'row',
          paddingHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          gap: Spacing.xs,
        },
        tab: {
          paddingHorizontal: Spacing.sm,
          paddingVertical: 6,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { fontSize: 12, fontWeight: '700', color: colors.text },
        tabTextActive: { color: colors.white },
        error: { color: colors.danger, textAlign: 'center', fontSize: 13, marginTop: Spacing.sm },
        emptyText: {
          textAlign: 'center',
          color: colors.textMuted,
          marginTop: Spacing.xl,
          paddingHorizontal: Spacing.lg,
        },
        chatRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          gap: Spacing.sm,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarText: { color: colors.white, fontWeight: '700' },
        chatName: { fontSize: 15, fontWeight: '700', color: colors.text },
        chatPreview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        pinIcon: { fontSize: 12, marginRight: -4 },
        chatTime: { fontSize: 12, color: colors.textMuted },
        rightCol: { alignItems: 'flex-end', gap: 4 },
        typeBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: Radius.sm,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        typeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
        unreadBadge: {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 4,
          borderRadius: 9,
          backgroundColor: colors.danger,
          justifyContent: 'center',
          alignItems: 'center',
        },
        unreadBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
      }),
    [colors]
  );

  const getOtherParticipantId = useCallback(
    (conv: Conversation) => conv.participantIds.find((id) => id !== currentUserId) || conv.participantIds[0],
    [currentUserId]
  );

  const getDisplayTitle = useCallback(
    (conv: Conversation) => {
      if (conv.type === 'course' || conv.type === 'group') {
        return conv.title || 'Untitled';
      }
      const otherId = getOtherParticipantId(conv);
      return participantNames[otherId] || '...';
    },
    [getOtherParticipantId, participantNames]
  );

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages');
      const list: Conversation[] = res.data?.data ?? [];
      setConversations(list);
      setError(null);

      // Resolve a name + role for every direct conversation's other
      // participant, same as web: course/group conversations already
      // carry their own title and need no lookup. Role is needed
      // specifically for the Lecturers tab filter below.
      const directOtherIds = list
        .filter((c) => c.type === 'direct')
        .map((c) => c.participantIds.find((id) => id !== currentUserId))
        .filter((id): id is string => !!id);

      // Also resolve the sender of each conversation's last message,
      // for group/course previews ("James: Assignment is due...") —
      // merged into the SAME lookup batch as direct-conversation
      // participants rather than a second separate pass, since a
      // sender's id may already be covered by the direct-participant
      // set (e.g. the other person in a direct chat is both the
      // "other participant" AND, if they sent last, the "sender").
      const lastMessageSenderIds = list
        .map((c) => c.lastMessage?.senderId)
        .filter((id): id is string => !!id && id !== currentUserId);

      const uniqueIds = [...new Set([...directOtherIds, ...lastMessageSenderIds])];

      const results = await Promise.allSettled(uniqueIds.map((id) => api.get(`/profile/summary/${id}`)));

      const names: Record<string, string> = {};
      const roles: Record<string, UserRole> = {};
      results.forEach((result, i) => {
        const id = uniqueIds[i];
        if (result.status === 'fulfilled') {
          names[id] = result.value.data?.data?.name || 'Unknown User';
          roles[id] = result.value.data?.data?.role || 'student';
        } else {
          names[id] = 'Unknown User';
          roles[id] = 'student';
        }
      });
      setParticipantNames(names);
      setParticipantRoles(roles);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load your messages.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUserId]);

  // Re-fetch on focus, same as web's window-focus listener — catches
  // unread counts dropping after reading a thread, without a
  // websocket. loadConversations only depends on currentUserId, so
  // this re-runs correctly if the logged-in user ever changes.
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadConversations();
  };

  // Optimistic toggle — flips the UI immediately rather than waiting
  // on the round-trip, since pin/unpin has no meaningful failure mode
  // a user needs to see mid-action (unlike sending a message, where
  // failure matters). Reverts only if the call actually fails, so a
  // slow Render cold-start doesn't leave the row looking unresponsive.
  const handleTogglePin = async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, isPinned: !c.isPinned } : c))
    );
    try {
      await api.post(`/messages/${conversationId}/pin`);
    } catch {
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, isPinned: !c.isPinned } : c))
      );
    }
  };

  const filteredConversations = useMemo(() => {
    let list: Conversation[];
    switch (activeTab) {
      case 'Unread':
        list = conversations.filter((c) => (c.unreadCount || 0) > 0);
        break;
      case 'Communities':
        list = conversations.filter((c) => c.type === 'course' || c.type === 'group');
        break;
      case 'Lecturers':
        list = conversations.filter((c) => {
          if (c.type !== 'direct') return false;
          const otherId = getOtherParticipantId(c);
          return participantRoles[otherId] === 'lecturer';
        });
        break;
      case 'Messages':
      default:
        list = conversations;
    }
    // Pinned first, each group keeping its existing lastMessageAt
    // order — a stable sort (Array.prototype.sort is stable per spec
    // since ES2019) so this never re-shuffles conversations within
    // the pinned or unpinned group on every render.
    return [...list].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));
  }, [activeTab, conversations, participantRoles, getOtherParticipantId]);

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
        <Text style={styles.title} accessibilityRole="header">
          Messages
        </Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/messages/new' as any)}
          accessibilityRole="button"
          accessibilityLabel="New message"
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow} accessibilityRole="tablist">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={tab}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <StatusBanner
        status="real"
        note="Conversations use the live backend. Messages refresh when you open a chat, not instantly in the background — there's no real-time push layer yet."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText} accessibilityRole="text">
              {activeTab === 'Unread' ? 'Nothing unread.' : 'No conversations here yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const displayTitle = getDisplayTitle(item);
            const unread = item.unreadCount || 0;
            return (
              <TouchableOpacity
                style={styles.chatRow}
                onPress={() => router.push(`/chat/${item._id}` as any)}
                onLongPress={() => handleTogglePin(item._id)}
                accessibilityRole="button"
                accessibilityLabel={`${displayTitle}${item.type !== 'direct' ? `, ${item.type}` : ''}${unread > 0 ? `, ${unread} unread` : ''}${item.isPinned ? ', pinned' : ''}`}
                accessibilityHint="Double tap to open, long press to pin or unpin"
              >
                {item.isPinned ? (
                  <Text style={styles.pinIcon} accessibilityElementsHidden importantForAccessibility="no">
                    📌
                  </Text>
                ) : null}
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={styles.avatarText}>{displayTitle.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatName}>{displayTitle}</Text>
                  {item.lastMessage ? (
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {item.type !== 'direct' && item.lastMessage.senderId !== currentUserId
                        ? `${participantNames[item.lastMessage.senderId] || '...'}: ${item.lastMessage.preview}`
                        : item.lastMessage.senderId === currentUserId
                        ? `You: ${item.lastMessage.preview}`
                        : item.lastMessage.preview}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rightCol}>
                  {item.type !== 'direct' ? (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.type}</Text>
                    </View>
                  ) : null}
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : (
                    <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
