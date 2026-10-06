import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  isError?: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = '@unilink/ai-history/';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export async function loadAIConversations(
  userId: string
): Promise<AIConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.sort((a: AIConversation, b: AIConversation) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  } catch {
    return [];
  }
}

export async function saveAIConversations(
  userId: string,
  conversations: AIConversation[]
): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(conversations)
  );
}

export async function createAIConversation(
  userId: string
): Promise<AIConversation> {
  const now = new Date().toISOString();

  const conversation: AIConversation = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const existing = await loadAIConversations(userId);

  await saveAIConversations(userId, [conversation, ...existing]);

  return conversation;
}

export async function updateAIConversation(
  userId: string,
  conversation: AIConversation
): Promise<void> {
  const existing = await loadAIConversations(userId);

  const updated = [
    conversation,
    ...existing.filter((item) => item.id !== conversation.id),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  await saveAIConversations(userId, updated);
}

export async function deleteAIConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  const existing = await loadAIConversations(userId);

  await saveAIConversations(
    userId,
    existing.filter((item) => item.id !== conversationId)
  );
}
