import { ScrollView, StyleSheet, Text } from 'react-native';
import CampusHubContent from '../../src/components/CampusHubContent';
import { useColors, Spacing } from '../../src/constants/theme';

export default function CommunityHubScreen() {
  const colors = useColors();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        Community Hub
      </Text>

      <CampusHubContent />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
});
