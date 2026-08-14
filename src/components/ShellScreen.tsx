import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBanner } from './StatusBanner';
import { Colors, Radius, Spacing } from '../constants/theme';

interface ShellSection {
  title: string;
  items: string[];
  backendNote: string;
}

interface ShellScreenProps {
  title: string;
  subtitle?: string;
  sections: ShellSection[];
}

/**
 * Shared template for all UI-shell screens (feature areas with no
 * backend yet). Renders the feature's sub-items as inert placeholder
 * cards so the navigation/IA can be reviewed, without pretending any
 * of it is wired to real data. Every section states exactly what
 * backend model/route it is waiting on — replace this whole screen
 * once that backend work lands, don't just delete the banner.
 */
export function ShellScreen({ title, subtitle, sections }: ShellScreenProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <StatusBanner status="shell" note={section.backendNote} />
          {section.items.map((item) => (
            <View key={item} style={styles.itemCard}>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.md,
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  itemCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  itemText: {
    fontSize: 14,
    color: Colors.text,
  },
});
