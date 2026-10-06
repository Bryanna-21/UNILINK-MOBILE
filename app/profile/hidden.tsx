import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

type HiddenPost = { _id: string; title?: string; content?: string; createdAt?: string };
const extractArray = (res: any): HiddenPost[] => Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data?.posts) ? res.data.posts : [];

export default function HiddenPostsScreen() {
  const colors = useColors();
  const [items, setItems] = useState<HiddenPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: Spacing.md },
    title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: Spacing.lg },
    row: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    text: { color: colors.text, fontSize: 14, fontWeight: '600' },
    restore: { marginTop: Spacing.sm, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    restoreText: { color: colors.primary, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    muted: { color: colors.textMuted, textAlign: 'center' },
  }), [colors]);
  const load = useCallback(async () => { setLoading(true); try { const res = await api.get('/posts/hidden'); setItems(extractArray(res)); } catch { setItems([]); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const restore = async (id: string) => { setRestoring(id); try { await api.delete(`/posts/hidden/${id}`); setItems((current) => current.filter((item) => item._id !== id)); } catch (err: any) { Alert.alert('Could not restore', err?.response?.data?.message || 'Please try again.'); } finally { setRestoring(null); } };
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={styles.container}><Text style={styles.title}>Hidden Posts</Text>{items.length === 0 ? <View style={styles.center}><Text style={styles.muted}>No hidden posts.</Text></View> : <FlatList data={items} keyExtractor={(item) => item._id} renderItem={({ item }) => <View style={styles.row}><Text style={styles.text} numberOfLines={3}>{item.title || item.content || 'Post'}</Text><TouchableOpacity style={styles.restore} onPress={() => restore(item._id)} disabled={restoring === item._id}>{restoring === item._id ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.restoreText}>Restore</Text>}</TouchableOpacity></View>} />}</View>;
}
