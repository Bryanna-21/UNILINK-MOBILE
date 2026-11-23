import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useColors, Radius, Spacing } from '../src/constants/theme';
import { getComingSoon, ComingSoonItem } from '../src/api/config';

// What we are working on. The list comes from the server (GET /api/config), so it can change without a new app release.
const ICONS: Record<string, string> = {
  call: '📞',
  mic: '🎙️',
  'alert-circle': '🚨',
  notifications: '🔔',
  image: '🖼️',
  'document-text': '📄',
  people: '👥',
};

export default function ComingSoonScreen() {
  const colors = useColors();
  const [items, setItems] = useState<ComingSoonItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      setItems(await getComingSoon());
    } catch {
      setError('Could not load the list. Check your connection and pull down to try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl },
        back: { paddingVertical: Spacing.sm },
        backText: { fontSize: 14, fontWeight: '700', color: colors.primary },
        title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: Spacing.xs },
        sub: { fontSize: 13, color: colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
        card: { flexDirection: 'row', gap: Spacing.md, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.sm },
        icon: { fontSize: 26 },
        cardBody: { flex: 1 },
        cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
        cardText: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
        eta: { alignSelf: 'flex-start', marginTop: Spacing.sm, fontSize: 11, fontWeight: '700', color: colors.primary, backgroundColor: colors.primarySoft, paddingVertical: 3, paddingHorizontal: 8, borderRadius: Radius.full, overflow: 'hidden' },
        empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
        error: { fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: Spacing.lg },
        link: { marginTop: Spacing.lg, alignItems: 'center' },
        linkText: { fontSize: 14, fontWeight: '700', color: colors.primary },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">
        Coming soon
      </Text>
      <Text style={styles.sub}>What we are working on next. Nothing here is promised for a particular date.</Text>

      {items === null && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items && items.length === 0 ? <Text style={styles.empty}>Nothing to announce right now.</Text> : null}

      {(items ?? []).map((item) => (
        <View key={item.key} style={styles.card} accessible accessibilityLabel={`${item.title}. ${item.description}${item.eta ? `. ${item.eta}` : ''}`}>
          <Text style={styles.icon}>{ICONS[item.icon] ?? '✨'}</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.cardText}>{item.description}</Text> : null}
            {item.eta ? <Text style={styles.eta}>{item.eta}</Text> : null}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.link} onPress={() => router.push('/settings/report-problem' as any)} accessibilityRole="button">
        <Text style={styles.linkText}>Have an idea? Tell us</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
