import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: LIVE — this screen's navigation is real, and now so are
// all three destinations. Library, Marketplace, and Events each fetch
// from the real backend (see each screen for its own endpoint notes).

const EXPLORE_ITEMS = [
  { key: 'library', title: 'Library', icon: '📖', route: '/library' },
  { key: 'marketplace', title: 'Marketplace', icon: '🛒', route: '/marketplace' },
  { key: 'events', title: 'Events', icon: '🎟️', route: '/events' },
] as const;

export default function ExploreScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <StatusBanner status="real" note="Library, Marketplace, and Events are all live." />

      <View style={styles.grid}>
        {EXPLORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
    paddingBottom: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardIcon: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
});
