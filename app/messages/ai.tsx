import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import UniLinkAIIcon from '../../src/components/UniLinkAIIcon';
import {
  AIConversation,
  AIMessage,
  createAIConversation,
  deleteAIConversation,
  loadAIConversations,
  updateAIConversation,
} from '../../src/storage/aiHistory';

const CAPABILITIES = [
  'Summarize notes',
  'Explain a concept',
  'Generate a quiz',
  'Make flashcards',
  'Help plan an assignment',
  'Suggest a study timetable',
];

type AITab = 'AI' | 'History';

export default function AIChatScreen() {
  const colors = useColors();
  const userId = useAuthStore((s) => s.user?.id);

  const [activeTab, setActiveTab] = useState<AITab>('AI');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const listRef = useRef<FlatList<AIMessage>>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          position: 'relative',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.sm,
          minHeight: 64,
        },
        backButton: {
          width: 40,
          height: 40,
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 2,
        },
        backText: {
          color: colors.text,
          fontSize: 34,
          fontWeight: '300',
          lineHeight: 36,
        },
        headerTitleWrap: {
          position: 'absolute',
          left: 60,
          right: 60,
          top: Spacing.xl,
          bottom: Spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.text,
        },
        moreButton: {
          width: 40,
          height: 40,
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 2,
        },
        moreText: {
          color: colors.text,
          fontSize: 28,
          fontWeight: '800',
          lineHeight: 30,
        },
        menu: {
          position: 'absolute',
          top: 58,
          right: Spacing.md,
          minWidth: 190,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingVertical: 6,
          zIndex: 100,
          elevation: 8,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        menuItem: {
          paddingHorizontal: 16,
          paddingVertical: 13,
        },
        menuItemText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
        tabRow: {
          flexDirection: 'row',
          paddingHorizontal: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        tab: {
          paddingVertical: 11,
          paddingHorizontal: Spacing.sm,
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
        },
        aiTab: {
          marginRight: 'auto',
        },
        historyTab: {
          marginLeft: 'auto',
        },
        tabActive: {
          borderBottomColor: colors.primary,
        },
        tabText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.text,
        },
        tabTextActive: {
          color: colors.primary,
        },
        aiWelcome: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Spacing.xl,
        },
        aiLogoWrap: {
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: Spacing.md,
        },
        aiWelcomeTitle: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
        },
        aiWelcomeSubtitle: {
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 21,
          marginTop: Spacing.xs,
          marginBottom: Spacing.lg,
        },
        capabilitiesBox: {
          width: '100%',
          padding: Spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        capabilitiesTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        capabilityItem: {
          fontSize: 14,
          color: colors.textMuted,
          marginTop: 4,
        },
        bubble: {
          borderRadius: Radius.md,
          padding: Spacing.md,
          maxWidth: '82%',
        },
        userBubble: {
          backgroundColor: colors.primary,
          alignSelf: 'flex-end',
        },
        assistantBubble: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        },
        bubbleText: {
          fontSize: 14,
          color: colors.text,
        },
        userBubbleText: {
          color: colors.white,
        },
        errorBubble: {
          borderColor: colors.danger,
        },
        errorBubbleText: {
          color: colors.danger,
        },
        historyRow: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
        },
        historyTitle: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 15,
        },
        historyPreview: {
          color: colors.textMuted,
          fontSize: 13,
          marginTop: 4,
        },
        historyDate: {
          color: colors.textMuted,
          fontSize: 11,
          marginTop: 8,
        },
        emptyText: {
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: Spacing.xl,
          paddingHorizontal: Spacing.lg,
        },
        typingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: Spacing.md,
          paddingBottom: 4,
        },
        typingText: {
          fontSize: 12,
          color: colors.textMuted,
        },
        composer: {
          flexDirection: 'row',
          padding: Spacing.md,
          gap: Spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
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
        },
        sendButton: {
          backgroundColor: colors.primary,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          justifyContent: 'center',
        },
        sendButtonDisabled: {
          opacity: 0.5,
        },
        sendButtonText: {
          color: colors.white,
          fontWeight: '700',
        },
      }),
    [colors]
  );

  const loadHistory = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);

    try {
      const stored = await loadAIConversations(userId);
      setConversations(stored);

      setConversation(stored.length > 0 ? stored[0] : null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const startNewConversation = async () => {
    if (!userId) return;

    const created = await createAIConversation(userId);

    setConversations((prev) => [created, ...prev]);
    setConversation(created);
    setActiveTab('AI');
  };

  const openConversation = (item: AIConversation) => {
    setConversation(item);
    setActiveTab('AI');
  };

  const handleDelete = async (conversationId: string) => {
    if (!userId) return;

    await deleteAIConversation(userId, conversationId);

    const remaining = conversations.filter((item) => item.id !== conversationId);
    setConversations(remaining);

    if (conversation?.id === conversationId) {
      if (remaining.length > 0) {
        setConversation(remaining[0]);
      } else {
        setConversation(null);
      }
    }
  };

  const handleSend = async () => {
    const text = draft.trim();

    if (!text || isSending || !userId) return;

    let activeConversation = conversation;

    if (!activeConversation) {
      activeConversation = await createAIConversation(userId);
      setConversation(activeConversation);
      setConversations((prev) => [activeConversation!, ...prev]);
    }

    const userMessage: AIMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...activeConversation.messages, userMessage];

    const updatedConversation: AIConversation = {
      ...activeConversation,
      messages: updatedMessages,
      title:
        activeConversation.messages.length === 0
          ? text.length > 45
            ? `${text.slice(0, 45)}…`
            : text
          : activeConversation.title,
      updatedAt: new Date().toISOString(),
    };

    setConversation(updatedConversation);
    setConversations((prev) =>
      [updatedConversation, ...prev.filter((item) => item.id !== updatedConversation!.id)]
    );
    setDraft('');
    setIsSending(true);

    try {
      const history = updatedMessages.slice(-10).map((message) => ({
        role: message.role,
        content: message.text,
      }));

      const res = await api.post('/ai/ask', {
        message: text,
        history: history.slice(0, -1),
      });

      const reply: string = res.data?.data?.reply ?? 'No response received.';

      const assistantMessage: AIMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: reply,
        createdAt: new Date().toISOString(),
      };

      const finalConversation: AIConversation = {
        ...updatedConversation,
        messages: [...updatedMessages, assistantMessage],
        updatedAt: new Date().toISOString(),
      };

      setConversation(finalConversation);
      setConversations((prev) =>
        [finalConversation, ...prev.filter((item) => item.id !== finalConversation.id)]
      );

      await updateAIConversation(userId, finalConversation);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.message;

      const errorText =
        status === 429
          ? serverMessage ?? "You've reached today's AI request limit. Try again tomorrow."
          : serverMessage ?? 'Could not reach the AI assistant. Please try again.';

      const errorMessage: AIMessage = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        text: errorText,
        createdAt: new Date().toISOString(),
        isError: true,
      };

      const failedConversation: AIConversation = {
        ...updatedConversation,
        messages: [...updatedMessages, errorMessage],
        updatedAt: new Date().toISOString(),
      };

      setConversation(failedConversation);
      setConversations((prev) =>
        [failedConversation, ...prev.filter((item) => item.id !== failedConversation.id)]
      );

      await updateAIConversation(userId, failedConversation);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      </View>
    );
  }

  const messages = conversation?.messages ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            UniLink AI
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setMenuVisible((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel="UniLink AI menu"
        >
          <Text style={styles.moreText}>⋮</Text>
        </TouchableOpacity>

        {menuVisible ? (
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                startNewConversation();
              }}
            >
              <Text style={styles.menuItemText}>New conversation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert(
                  'UniLink AI',
                  'AI settings will be available here as assistant controls are added.'
                );
              }}
            >
              <Text style={styles.menuItemText}>AI settings</Text>
            </TouchableOpacity>

            {conversation ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);

                  Alert.alert(
                    'Clear conversation',
                    'Clear all messages from this conversation?',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: async () => {
                          const cleared: AIConversation = {
                            ...conversation,
                            messages: [],
                            updatedAt: new Date().toISOString(),
                          };

                          setConversation(cleared);
                          if (userId) {
                            await updateAIConversation(userId, cleared);
                            await loadHistory();
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.menuItemText}>Clear conversation</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.tabRow} accessibilityRole="tablist">
        <TouchableOpacity
          style={[
            styles.tab,
            styles.aiTab,
            activeTab === 'AI' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('AI')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'AI' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'AI' && styles.tabTextActive,
            ]}
          >
            AI
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            styles.historyTab,
            activeTab === 'History' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('History')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'History' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'History' && styles.tabTextActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'History' ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No AI conversations yet.</Text>
          }
          renderItem={({ item }) => {
            const lastMessage = item.messages[item.messages.length - 1];

            return (
              <TouchableOpacity
                style={styles.historyRow}
                onPress={() => openConversation(item)}
                onLongPress={() => handleDelete(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                accessibilityHint="Long press to delete this AI conversation"
              >
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={styles.historyPreview} numberOfLines={2}>
                  {lastMessage?.text || 'No messages yet.'}
                </Text>

                <Text style={styles.historyDate}>
                  {new Date(item.updatedAt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <>
          {messages.length === 0 ? (
            <View style={styles.aiWelcome}>
              <View style={styles.aiLogoWrap}>
                <UniLinkAIIcon size={58} />
              </View>

              <Text style={styles.aiWelcomeTitle}>UniLink AI</Text>

              <Text style={styles.aiWelcomeSubtitle}>
                Your academic AI assistant. Ask anything about your studies,
                then keep the conversation and return to it later from History.
              </Text>

              <View style={styles.capabilitiesBox}>
                <Text style={styles.capabilitiesTitle}>
                  UniLink AI can help you:
                </Text>

                {CAPABILITIES.map((item) => (
                  <Text key={item} style={styles.capabilityItem}>
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                padding: Spacing.md,
                gap: Spacing.sm,
              }}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: true })
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.bubble,
                    item.role === 'user'
                      ? styles.userBubble
                      : styles.assistantBubble,
                    item.isError && styles.errorBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      item.role === 'user' && styles.userBubbleText,
                      item.isError && styles.errorBubbleText,
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              )}
            />
          )}

          {isSending && (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          )}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Ask UniLink AI"
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              editable={!isSending}
              accessibilityLabel="Ask UniLink AI"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!draft.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
              accessibilityRole="button"
              accessibilityLabel="Ask"
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.sendButtonText}>Ask</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
