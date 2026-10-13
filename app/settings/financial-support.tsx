import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL. Loans and sponsorships posted by your university's administration, or for all of
// UniLink (GET /opportunities). UniLink only LISTS them and links to the provider: it takes no
// applications and handles no money, so there is nothing to apply for inside the app.

interface Listing {
  id: string;
  type: 'loan' | 'sponsorship';
  title: string;
  provider: string;
  description: string;
  eligibility: string;
  amountText: string;
  link: string;
  deadline: string | null;
  universityName: string;
}

type Filter = 'all' | 'loan' | 'sponsorship';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'loan', label: 'Loans' },
  { key: 'sponsorship', label: 'Sponsorships' },
];

export default function FinancialSupportScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
        note: { fontSize: 12, color: colors.textMuted, marginBottom: Spacing.sm },
        chips: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
        chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
        chipTextActive: { color: colors.white },
        error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: Spacing.md },
        empty: { textAlign: 'center', color: colors.textMuted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
        card: { backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.sm },
        badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        badge: { fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' },
        scope: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },
        title: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        body: { fontSize: 14, color: colors.text, marginTop: Spacing.sm },
        label: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: Spacing.sm },
        deadline: { fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: Spacing.sm },
        button: { marginTop: Spacing.md, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
        buttonText: { color: colors.white, fontWeight: '700' },
      }),
    [colors]
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const res = await api.get('/opportunities', { params: filter === 'all' ? {} : { type: filter } });
        setItems(res.data?.data ?? []);
        setError(null);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Could not load listings. Pull down to try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // The backend only stores https links, but check again before opening anything.
  const open = (url: string) => {
    if (!/^https:\/\//i.test(url)) return;
    Linking.openURL(url).catch(() => Alert.alert('Could not open the link', 'Try again, or copy it into your browser.'));
  };

  const deadlineText = (d: string | null) => (d ? `Closes ${new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : null);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Financial Support', headerShown: true }} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>Posted by your university's administration. UniLink only lists these: apply with the provider, using the link on each one. Never pay anyone to apply.</Text>
            <View style={styles.chips}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, filter === f.key && styles.chipActive]}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === f.key }}
                >
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator color={colors.primary} style={{ marginBottom: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>Nothing is open right now. New loans and sponsorships appear here when your university posts them.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{item.type}</Text>
              <Text style={styles.scope} numberOfLines={1}>
                {item.universityName}
              </Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.provider}
              {item.amountText ? ` · ${item.amountText}` : ''}
            </Text>
            <Text style={styles.body}>{item.description}</Text>
            {!!item.eligibility && (
              <>
                <Text style={styles.label}>Who can apply</Text>
                <Text style={styles.body}>{item.eligibility}</Text>
              </>
            )}
            {deadlineText(item.deadline) && <Text style={styles.deadline}>{deadlineText(item.deadline)}</Text>}
            {!!item.link && (
              <TouchableOpacity style={styles.button} onPress={() => open(item.link)} accessibilityRole="button" accessibilityLabel={`Learn more about ${item.title}`}>
                <Text style={styles.buttonText}>Learn more and apply</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}
