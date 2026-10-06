import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

type DetailRowStyles = {
  detailRow: any;
  detailLabel: any;
  detailValue: any;
};

function DetailRow({ label, value, styles }: { label: string; value: string; styles: DetailRowStyles }) {
  return (
    <View style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function MeScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Accounts that signed in before usernames existed have none cached on this device.
  // Fetch the current profile once and merge the username in.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        const me = res.data?.user;
        if (cancelled || !me || !user) return;
        if (me.username && me.username !== user.username) setUser({ ...user, username: me.username });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        card: { alignItems: 'center', paddingBottom: Spacing.xl },
        coverWrap: { width: '100%', height: 120, backgroundColor: colors.surface },
        coverImage: { width: '100%', height: '100%' },
        avatarSection: { alignItems: 'center', marginTop: -40, paddingHorizontal: Spacing.lg },
        avatar: {
          width: 80,
          height: 80,
          borderRadius: Radius.full,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: Spacing.sm,
          borderWidth: 3,
          borderColor: colors.background,
        },
        avatarImage: { width: '100%', height: '100%', borderRadius: Radius.full },
        avatarText: { fontSize: 32, color: colors.white, fontWeight: '800' },
        name: { fontSize: 20, fontWeight: '800', color: colors.text },
        email: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        bio: { fontSize: 14, color: colors.text, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.lg },
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
      <View style={styles.card}>
        <View style={styles.coverWrap}>
          {user?.coverUrl ? <Image source={{ uri: user.coverUrl }} style={styles.coverImage} resizeMode="cover" /> : null}
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
            )}
          </View>
          <Text style={styles.name} accessibilityRole="header">
            {user?.name || 'Unknown'}
          </Text>
          {user?.username ? <Text style={styles.email}>@{user.username}</Text> : null}
          <Text style={styles.email}>{user?.email}</Text>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow label="Role" value={user?.role || '—'} styles={styles} />
        <DetailRow label="University ID" value={user?.universityId || 'Not set'} styles={styles} />
        <DetailRow label="Phone" value={user?.phone || 'Not set'} styles={styles} />
      </View>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/profile/following' as any)}
        accessibilityRole="link"
        accessibilityLabel="Following and followers"
      >
        <Text style={styles.linkRowText}>Following & Followers</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/people' as any)}
        accessibilityRole="link"
        accessibilityLabel="Find people"
      >
        <Text style={styles.linkRowText}>Find people</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/people/username' as any)}
        accessibilityRole="link"
        accessibilityLabel="Change username"
      >
        <Text style={styles.linkRowText}>Username{user?.username ? ' (@' + user.username + ')' : ''}</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/profile/edit')}
        accessibilityRole="link"
        accessibilityLabel="Edit Profile"
      >
        <Text style={styles.linkRowText}>Edit Profile</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/profile/achievements')}
        accessibilityRole="link"
        accessibilityLabel="Achievements and Portfolio"
      >
        <Text style={styles.linkRowText}>Achievements & Portfolio</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/settings')}
        accessibilityRole="link"
        accessibilityLabel="Settings"
      >
        <Text style={styles.linkRowText}>Settings</Text>
        <Text style={styles.linkRowChevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
