import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: SHELL — no Message/Conversation model exists on the backend.
// A socket.io server was added to the backend since this was written
// (for the Admin Panel's live notifications — src/socket.js), but it
// only admits admin-role JWTs into one "admins" room. It has no
// student-facing events, rooms, or message persistence — real chat
// still needs its own Message/Conversation model and event design,
// not just "connect to the existing server."

const PLACEHOLDER_CHATS = [
  { id: '1', name: 'Class Group Chat', preview: 'Not a real conversation — placeholder', time: '' },
  { id: '2', name: 'Study Partner', preview: 'Not a real conversation — placeholder', time: '' },
];

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <StatusBanner
        status="shell"
        note="A socket.io server now exists on the backend (built for Admin Panel notifications) but has no student-facing rooms or events. Still needs: a Message/Conversation model + real chat wiring."
      />
      <FlatList
        data={PLACEHOLDER_CHATS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatRow}
            onPress={() => router.push(`/chat/${item.id}` as any)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatPreview}>{item.preview}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    padding: Spacing.md,
    paddingTop: Spacing.xl,
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
    opacity: 0.7,
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
  chatPreview: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
