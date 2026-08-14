import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL (partial) — shows only fields that genuinely exist on
// the User model (name, email, role, universityId). Achievements,
// Badges, Skills, Certificates, Portfolio, Resume from the spec are
// shells: no backend fields exist for any of them.

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView style={styles.container}>
      <StatusBanner status="real" note="Shows your actual account data only." />

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Unknown'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow label="Role" value={user?.role || '—'} />
        <DetailRow label="University ID" value={user?.universityId || 'Not set'} />
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: {
    fontSize: 32,
    color: Colors.white,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  email: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  linkRowChevron: {
    fontSize: 20,
    color: Colors.textMuted,
  },
});
