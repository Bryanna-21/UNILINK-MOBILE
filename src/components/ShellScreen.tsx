import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBanner } from './StatusBanner';
import { useColors, Radius, Spacing } from '../constants/theme';

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
  const colors = useColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          padding: Spacing.md,
          paddingTop: Spacing.xl,
        },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        subtitle: {
          fontSize: 13,
          color: colors.textMuted,
          marginTop: 2,
        },
        section: {
          marginTop: Spacing.lg,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
        },
        itemCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          padding: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: 0.6,
        },
        itemText: {
          fontSize: 14,
          color: colors.text,
        },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

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
