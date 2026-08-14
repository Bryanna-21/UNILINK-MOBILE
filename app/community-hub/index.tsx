import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — navigates to five real, backend-connected screens.
// Each of Clubs, Projects, Study Groups, Polls, and Announcements has
// its own model, list/create routes, and (where applicable) join
// routes on the real backend now — see community.routes.js.

const SECTIONS = [
  { title: 'Clubs', subtitle: 'Join or start a club', href: '/clubs' },
  { title: 'Projects', subtitle: 'Collaborative student projects', href: '/projects' },
  { title: 'Study Groups', subtitle: 'Find or start a study group', href: '/study-groups' },
  { title: 'Polls', subtitle: 'Vote on active polls', href: '/polls' },
  { title: 'Announcements', subtitle: 'Campus and course announcements', href: '/announcements' },
] as const;

export default function CommunityHubScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
      <Text style={styles.title}>Community Hub</Text>
      <StatusBanner status="real" note="Clubs, Projects, Study Groups, Polls, and Announcements are all connected to the real backend now." />

      {SECTIONS.map((section) => (
        <TouchableOpacity
          key={section.href}
          style={styles.card}
          onPress={() => router.push(section.href as any)}
        >
          <Text style={styles.cardTitle}>{section.title}</Text>
          <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  cardSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
});
