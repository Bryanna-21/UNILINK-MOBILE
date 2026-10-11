import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL. One shared room for admins and superadmins (GET/POST /staff-chat/messages).
// Refreshes every 5 seconds while the screen is open; stops when you leave it.
interface Msg {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
  mine: boolean;
}

const POLL_MS = 5000;
const merge = (prev: Msg[], incoming: Msg[]) => {
  const seen = new Set(prev.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length ? [...prev, ...added] : prev;
};

export default function StaffChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const lastRef = useRef<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: Spacing.md, gap: Spacing.sm },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center', padding: Spacing.sm },
        bubble: { maxWidth: '82%', borderRadius: Radius.md, padding: Spacing.sm },
        mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
        theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        who: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
        textMine: { color: colors.white, fontSize: 14 },
        textTheirs: { color: colors.text, fontSize: 14 },
        time: { fontSize: 10, marginTop: 3, alignSelf: 'flex-end', color: colors.textMuted },
        timeMine: { color: 'rgba(255,255,255,0.8)' },
        composer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
        input: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8, color: colors.text, maxHeight: 110 },
        send: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
        sendText: { color: colors.white, fontWeight: '700' },
        empty: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl },
      }),
    [colors]
  );

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/staff-chat/messages', { params: lastRef.current ? { after: lastRef.current } : { limit: 50 } });
      const incoming: Msg[] = res.data?.data ?? [];
      if (incoming.length) {
        lastRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((prev) => merge(prev, incoming));
      }
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not reach the staff room.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
      const t = setInterval(fetchMessages, POLL_MS);
      return () => clearInterval(t);
    }, [fetchMessages])
  );

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post('/staff-chat/messages', { text: body });
      const created: Msg = res.data?.data;
      if (created) {
        lastRef.current = created.createdAt;
        setMessages((prev) => merge(prev, [created]));
      }
      setText('');
    } catch (err: any) {
      Alert.alert('Message not sent', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const remove = (m: Msg) => {
    Alert.alert('Delete this message?', 'It is removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/staff-chat/messages/${m.id}`);
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <>
            <StatusBanner status="real" note="Staff room: admins and superadmins only. Updates every 5 seconds while open." />
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={!error ? <Text style={styles.empty}>No messages yet. Say hello.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => item.mine && remove(item)}
            style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}
          >
            {!item.mine && (
              <Text style={styles.who}>
                {item.sender.name} · {item.sender.role}
              </Text>
            )}
            <Text style={item.mine ? styles.textMine : styles.textTheirs}>{item.text}</Text>
            <Text style={[styles.time, item.mine && styles.timeMine]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message the staff room"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          accessibilityLabel="Message"
        />
        <TouchableOpacity style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel="Send">
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
