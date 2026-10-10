import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../api/client';
import { StatusBanner } from '../StatusBanner';
import { useColors, Radius, Spacing } from '../../constants/theme';

// STATUS: REAL. One list/create/edit/delete screen reused for campuses, faculties and
// departments. GET/POST /admin/<path>, PUT/DELETE /admin/<path>/:id, all superadmin-only on
// the backend (a non-superadmin sees the server's own error message). Same style as the
// unit catalog screen. Fields with `ref` become a pick-list loaded from another admin list.

export interface StructureField {
  key: string;
  label: string;
  required?: boolean;
  ref?: string; // e.g. "/admin/universities"
}
export interface StructureLine {
  label: string;
  keys: string[]; // first key with a value wins
}
interface Props {
  title: string;
  singular: string;
  path: string; // e.g. "/admin/campuses"
  note: string;
  fields: StructureField[];
  lines: StructureLine[];
}

const idOf = (o: any): string => o?.id ?? o?._id;

export default function StructureList({ title, singular, path, note, fields, lines }: Props) {
  const colors = useColors();
  const styles = useStyles(colors);

  const [items, setItems] = useState<any[]>([]);
  const [refs, setRefs] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Stable key so a parent re-render passing a fresh `fields` array cannot retrigger loading.
  const refKey = fields.map((f) => `${f.key}:${f.ref ?? ''}`).join('|');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get(path, { params: { limit: 100 } });
        setItems(res.data?.data ?? []);
        const next: Record<string, any[]> = {};
        for (const f of fields.filter((x) => x.ref)) {
          const r = await api.get(f.ref!, { params: { limit: 100 } });
          next[f.key] = r.data?.data ?? [];
        }
        setRefs(next);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || `Could not load ${title.toLowerCase()}.`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, title, refKey]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setFormVisible(true);
  };

  const openEdit = (item: any) => {
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      const v = item[f.key];
      next[f.key] = (v && typeof v === 'object' ? idOf(v) : v) ?? '';
    });
    setEditing(item);
    setForm(next);
    setFormVisible(true);
  };

  const handleSave = async () => {
    const missing = fields.find((f) => f.required && !(form[f.key] || '').trim());
    if (missing) {
      Alert.alert('Missing field', `${missing.label} is required.`);
      return;
    }
    const body: Record<string, string> = {};
    fields.forEach((f) => {
      const v = (form[f.key] || '').trim();
      if (v) body[f.key] = v;
    });
    setSaving(true);
    try {
      if (editing) await api.put(`${path}/${idOf(editing)}`, body);
      else await api.post(path, body);
      setFormVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(`Delete this ${singular.toLowerCase()}?`, `"${item.name}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`${path}/${idOf(item)}`);
            load();
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message || 'Something went wrong.');
          }
        },
      },
    ]);
  };

  // Show a name; if the API sent only an id, look it up in the pick-lists.
  const valueOf = (item: any, keys: string[]) => {
    for (const k of keys) {
      const v = item[k];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'object') return v.name ?? '—';
      const found = Object.values(refs)
        .flat()
        .find((o: any) => idOf(o) === v);
      return found ? (found as any).name : String(v);
    }
    return '—';
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        {!!item.code && <Text style={styles.cardCode}>{item.code}</Text>}
      </View>
      {lines.map((l) => (
        <Text key={l.label} style={styles.meta}>
          {l.label}: {valueOf(item, l.keys)}
        </Text>
      ))}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEdit(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => idOf(item)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <StatusBanner status="real" note={note} />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}
            {loading && <ActivityIndicator color={colors.primary} style={{ marginBottom: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nothing here yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityRole="button" accessibilityLabel={`Add a ${singular.toLowerCase()}`}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? `Edit ${singular}` : `New ${singular}`}</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {fields.map((f) =>
                f.ref ? (
                  <View key={f.key} style={{ marginBottom: Spacing.sm }}>
                    <Text style={styles.fieldLabel}>
                      {f.label}
                      {f.required ? ' *' : ''}
                    </Text>
                    <ScrollView style={styles.pickList} nestedScrollEnabled>
                      {(refs[f.key] || []).map((o: any) => {
                        const selected = form[f.key] === idOf(o);
                        return (
                          <TouchableOpacity
                            key={idOf(o)}
                            style={[styles.pickRow, selected && styles.pickRowSelected]}
                            onPress={() => setForm({ ...form, [f.key]: idOf(o) })}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <Text style={[styles.pickText, selected && styles.pickTextSelected]}>{o.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {(refs[f.key] || []).length === 0 && <Text style={styles.meta}>None available.</Text>}
                    </ScrollView>
                  </View>
                ) : (
                  <TextInput
                    key={f.key}
                    style={styles.input}
                    placeholder={f.label + (f.required ? ' *' : '')}
                    placeholderTextColor={colors.textMuted}
                    value={form[f.key] || ''}
                    onChangeText={(t) => setForm({ ...form, [f.key]: t })}
                  />
                )
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>{editing ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
        emptyContainer: { flexGrow: 1, padding: Spacing.md },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        errorText: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        cardName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
        cardCode: { fontSize: 12, fontWeight: '800', color: colors.primary },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
        editText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        deleteText: { fontSize: 12, fontWeight: '700', color: colors.danger },
        emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
        fab: {
          position: 'absolute',
          right: Spacing.lg,
          bottom: Spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
        },
        fabText: { fontSize: 28, color: colors.white, fontWeight: '700', lineHeight: 30 },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalCard: { backgroundColor: colors.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
        fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 14,
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        pickList: { maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, backgroundColor: colors.surface },
        pickRow: { paddingVertical: 10, paddingHorizontal: Spacing.md },
        pickRowSelected: { backgroundColor: colors.primary },
        pickText: { fontSize: 14, color: colors.text },
        pickTextSelected: { color: colors.white, fontWeight: '700' },
        modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        cancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        cancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
        saveButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center' },
        saveButtonDisabled: { opacity: 0.5 },
        saveButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
