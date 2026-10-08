import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore, UserRole } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import UniLinkAIIcon from '../../src/components/UniLinkAIIcon';
import LoadingSkeleton, { LoadingSkeletonList } from '../../src/components/LoadingSkeleton';

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

type ConversationType = 'direct' | 'course' | 'group' | 'self';

interface SuggestedPerson {
  _id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  isFollowing?: boolean;
  reason?: string;
}

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
  const [isOpeningSavedMessages, setIsOpeningSavedMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedPerson[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [followingIds, setFollowingIds] = useState<Record<string, boolean>>({});
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.sm,
        },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        newButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
        },
        newButtonText: {
          color: colors.white,
          fontWeight: '700',
          fontSize: 13,
        },
        tabRow: {
          marginTop: Spacing.xs,
          paddingHorizontal: Spacing.md,
          height: 44,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        tabContent: {
          flexDirection: 'row',
          gap: Spacing.lg,
          paddingRight: Spacing.md,
        },
        tab: {
          paddingVertical: Spacing.sm,
        },
        tabActive: {},
        tabText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
        },
        tabTextActive: {
          color: colors.primary,
          fontWeight: '800',
        },
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
          minHeight: 68,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          gap: Spacing.sm,
        },
        savedMessagesRow: {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 68,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          gap: Spacing.sm,
        },
        savedMessagesAvatar: {
          width: 46,
          height: 46,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        savedMessagesAvatarText: {
          color: colors.white,
          fontWeight: '900',
          fontSize: 17,
        },
        savedMessagesName: {
          fontSize: 15,
          fontWeight: '800',
          color: colors.text,
        },
        savedMessagesSubtitle: {
          fontSize: 13,
          color: colors.textMuted,
          marginTop: 3,
        },
        avatar: {
          width: 46,
          height: 46,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarText: {
          color: colors.white,
          fontWeight: '800',
          fontSize: 16,
        },
        chatName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        chatNameUnread: {
          fontWeight: '900',
        },
        chatPreview: {
          fontSize: 13,
          color: colors.textMuted,
          marginTop: 3,
        },
        chatPreviewUnread: {
          color: colors.text,
          fontWeight: '700',
        },
        unreadDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
          marginLeft: -4,
          marginRight: 2,
        },
        pinMarker: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.primary,
          marginRight: 2,
        },
        chatTime: {
          fontSize: 11,
          color: colors.textMuted,
        },
        rightCol: {
          alignItems: 'flex-end',
          gap: 5,
          minWidth: 48,
        },
        typeBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: Radius.sm,
          backgroundColor: colors.background,
        },
        typeBadgeText: {
          fontSize: 9,
          fontWeight: '700',
          color: colors.textMuted,
          textTransform: 'uppercase',
        },
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
        suggestionsSection: {
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        suggestionsHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
        },
        suggestionsTitle: {
          fontSize: 13,
          fontWeight: '800',
          color: colors.text,
        },
        suggestionsHint: {
          fontSize: 11,
          color: colors.textMuted,
        },
        suggestionList: {
          paddingHorizontal: Spacing.md,
          gap: Spacing.sm,
        },
        suggestionCard: {
          width: 150,
          padding: Spacing.sm,
          borderRadius: Radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        suggestionTop: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
        },
        suggestionAvatar: {
          width: 36,
          height: 36,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        suggestionAvatarImage: {
          width: '100%',
          height: '100%',
          borderRadius: Radius.full,
        },
        suggestionAvatarText: {
          color: colors.white,
          fontWeight: '800',
          fontSize: 13,
        },
        suggestionName: {
          flex: 1,
          fontSize: 12,
          fontWeight: '800',
          color: colors.text,
        },
        suggestionReason: {
          fontSize: 10,
          color: colors.textMuted,
          marginTop: 2,
        },
        followButton: {
          marginTop: Spacing.sm,
          minHeight: 30,
          borderRadius: Radius.sm,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: Spacing.sm,
        },
        followingButton: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        followButtonText: {
          color: colors.white,
          fontSize: 11,
          fontWeight: '800',
        },
        followingButtonText: {
          color: colors.text,
        },
        aiFloatingButton: {
          position: 'absolute',
          right: Spacing.md,
          bottom: Spacing.lg,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 6,
        },
        aiFloatingIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
      }),
    [colors]
  );

  const getOtherParticipantId = useCallback(
    (conv: Conversation) => conv.participantIds.find((id) => id !== currentUserId) || conv.participantIds[0],
    [currentUserId]
  );

  const getDisplayTitle = useCallback(
    (conv: Conversation) => {
      if (conv.type === 'self') {
        return 'Saved Messages';
      }

      if (conv.type === 'course' || conv.type === 'group') {
        return conv.title || 'Untitled';
      }

      const otherId = getOtherParticipantId(conv);
      return participantNames[otherId] || '...';
    },
    [currentUserId, getOtherParticipantId, participantNames]
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

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/people/suggestions');
      const list: SuggestedPerson[] = res.data?.data ?? [];
      setSuggestions(list.slice(0, 8));
      setFollowingIds(
        Object.fromEntries(
          list
            .filter((person) => person.isFollowing)
            .map((person) => [person._id, true])
        )
      );
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSuggestions();
    }, [loadSuggestions])
  );

  const handleFollowSuggestion = async (person: SuggestedPerson) => {
    if (followPending[person._id]) return;

    const wasFollowing = !!followingIds[person._id];

    setFollowPending((prev) => ({ ...prev, [person._id]: true }));
    setFollowingIds((prev) => ({ ...prev, [person._id]: !wasFollowing }));

    try {
      if (wasFollowing) {
        await api.delete(`/follow/${person._id}`);
      } else {
        await api.post(`/follow/${person._id}`);
      }

      // The backend is the source of truth for suggestions.
      // Re-fetch after a successful follow/unfollow so this list
      // reflects the current database relationship.
      await loadSuggestions();
    } catch (err: any) {
      if (!( !wasFollowing && err?.response?.status === 409 )) {
        setFollowingIds((prev) => ({ ...prev, [person._id]: wasFollowing }));
      }
    } finally {
      setFollowPending((prev) => ({ ...prev, [person._id]: false }));
    }
  };

  const visibleSuggestions = suggestions.filter(
    (person) => !followingIds[person._id]
  );

  const renderSuggestions = () => {
    if (activeTab !== 'Messages') return null;
    if (isLoadingSuggestions) {
      return (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>People you may know</Text>
          </View>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (visibleSuggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsSection}>
        <View style={styles.suggestionsHeader}>
          <Text style={styles.suggestionsTitle}>People you may know</Text>
          <Text style={styles.suggestionsHint}>Follow classmates</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionList}
        >
          {visibleSuggestions.map((person) => {
            const busy = !!followPending[person._id];

            return (
              <View key={person._id} style={styles.suggestionCard}>
                <TouchableOpacity
                  style={styles.suggestionTop}
                  onPress={() => router.push(`/user/${person._id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${person.name}'s profile`}
                >
                  <View
                    style={styles.suggestionAvatar}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    {person.avatarUrl ? (
                      <Image
                        source={{ uri: person.avatarUrl }}
                        style={styles.suggestionAvatarImage}
                      />
                    ) : (
                      <Text style={styles.suggestionAvatarText}>
                        {(person.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    {person.reason ? (
                      <Text style={styles.suggestionReason} numberOfLines={1}>
                        {person.reason}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.followButton,
                    followingIds[person._id] && styles.followingButton,
                  ]}
                  onPress={() => handleFollowSuggestion(person)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={
                    followingIds[person._id]
                      ? `Unfollow ${person.name}`
                      : `Follow ${person.name}`
                  }
                  accessibilityState={{ busy }}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        followingIds[person._id]
                          ? colors.text
                          : colors.white
                      }
                    />
                  ) : (
                    <Text
                      style={[
                        styles.followButtonText,
                        followingIds[person._id] &&
                          styles.followingButtonText,
                      ]}
                    >
                      {followingIds[person._id] ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadConversations();
    loadSuggestions();
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

  const handleOpenSavedMessages = async () => {
    if (isOpeningSavedMessages) return;

    const existing = conversations.find((item) => item.type === 'self');

    if (existing?._id) {
      router.push(`/chat/${existing._id}` as any);
      return;
    }

    setIsOpeningSavedMessages(true);
    try {
      const res = await api.post('/messages/start', { self: true });
      const conversation = res.data?.data;

      if (!conversation?._id) {
        throw new Error('Saved Messages conversation was not returned.');
      }

      setConversations((prev) => [
        ...prev.filter((item) => item.type !== 'self'),
        conversation,
      ]);

      router.push(`/chat/${conversation._id}` as any);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not open Saved Messages.'
      );
    } finally {
      setIsOpeningSavedMessages(false);
    }
  };

  const filteredConversations = useMemo(() => {
    let list: Conversation[];
    switch (activeTab) {
      case 'Unread':
        list = conversations.filter(
          (c) => c.type !== 'self' && (c.unreadCount || 0) > 0
        );
        break;
      case 'Communities':
        list = conversations.filter(
          (c) => c.type === 'course' || c.type === 'group'
        );
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
        list = conversations.filter((c) => c.type !== 'self');
    }

    // Pinned first, while preserving the existing conversation order
    // within the pinned and unpinned groups.
    return [...list].sort(
      (a, b) => Number(!!b.isPinned) - Number(!!a.isPinned)
    );
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

      <View
        style={styles.tabRow}
        accessibilityRole="tablist"
      >
        <View style={styles.tabContent}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
              accessibilityLabel={tab}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <LoadingSkeletonList rows={4} />
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {renderSuggestions()}

            {activeTab === 'Messages' ? (
              <TouchableOpacity
                style={styles.savedMessagesRow}
                onPress={handleOpenSavedMessages}
                disabled={isOpeningSavedMessages}
                accessibilityRole="button"
                accessibilityLabel="Saved Messages"
                accessibilityHint="Open your private Saved Messages conversation"
                accessibilityState={{ disabled: isOpeningSavedMessages }}
              >
                <View
                  style={styles.savedMessagesAvatar}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  <Text style={styles.savedMessagesAvatarText}>S</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.savedMessagesName}>Saved Messages</Text>
                  <Text style={styles.savedMessagesSubtitle}>
                    {isOpeningSavedMessages
                      ? 'Opening…'
                      : 'Message yourself'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item._id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: Spacing.xl,
            }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              activeTab === 'Messages' ? null : (
                <Text style={styles.emptyText} accessibilityRole="text">
                  {activeTab === 'Unread'
                    ? 'Nothing unread.'
                    : 'No conversations here yet.'}
                </Text>
              )
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
                  <View
                    style={styles.pinMarker}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={styles.avatarText}>{displayTitle.charAt(0).toUpperCase()}</Text>
                </View>
                {unread > 0 ? (
                  <View
                    style={styles.unreadDot}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chatName, unread > 0 && styles.chatNameUnread]}>
                    {displayTitle}
                  </Text>
                  {item.lastMessage ? (
                    <Text
                      style={[styles.chatPreview, unread > 0 && styles.chatPreviewUnread]}
                      numberOfLines={1}
                    >
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
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.aiFloatingButton}
        onPress={() => router.push('/messages/ai' as any)}
        accessibilityRole="button"
        accessibilityLabel="Open UniLink AI"
        accessibilityHint="Opens your UniLink AI assistant"
      >
        <View style={styles.aiFloatingIcon}>
          <UniLinkAIIcon size={48} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
