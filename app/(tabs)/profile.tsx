import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

type DetailRowStyles = {
  detailRow: any;
  detailLabel: any;
  detailValue: any;
};

function DetailRow({ label, value, styles }: { label: string; value: string; styles: DetailRowStyles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        card: { alignItems: 'center', paddingVertical: Spacing.xl },
        avatar: {
          width: 80,
          height: 80,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: Spacing.sm,
        },
        avatarText: { fontSize: 32, color: colors.white, fontWeight: '800' },
        name: { fontSize: 20, fontWeight: '800', color: colors.text },
        email: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        detailsCard: {
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        detailRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        detailLabel: { color: colors.textMuted, fontSize: 14 },
        detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
        section: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
        sectionTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
        },
        linkRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.surface,
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        },
        linkRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
        linkRowChevron: { fontSize: 20, color: colors.textMuted },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container}>
      <StatusBanner status="real" note="Shows your actual account data only." />

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Unknown'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow label="Role" value={user?.role || '—'} styles={styles} />
        <DetailRow label="University ID" value={user?.universityId || 'Not set'} styles={styles} />
      </View>

      <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/profile/achievements')}>
        <Text style={styles.linkRowText}>Achievements & Portfolio</Text>
        <Text style={styles.linkRowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/settings')}>
        <Text style={styles.linkRowText}>Settings</Text>
        <Text style={styles.linkRowChevron}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
