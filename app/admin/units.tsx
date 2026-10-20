import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — GET/POST /api/admin/units, DELETE
// /api/admin/units/:id all call the live backend, superadmin-only.
// code must be globally unique (enforced server-side) — this is the
// same catalog course.controller.js's attachUnit references from the
// lecturer side.

interface Unit {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  university: string | null;
  status: string;
}

export default function AdminUnitsScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [credits, setCredits] = useState('3');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/admin/units', { params: { limit: 100 } });
      setUnits(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load units.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = () => {
    setCode('');
    setName('');
    setDescription('');
    setCredits('3');
    setFormVisible(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !credits) {
      Alert.alert('Missing fields', 'Code, name, and credits are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/units', {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        credits: Number(credits),
      });
      setFormVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (unit: Unit) => {
    Alert.alert('Delete this unit?', `"${unit.code} — ${unit.name}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/admin/units/${unit.id}`);
            load();
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message || 'Something went wrong.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Unit }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.unitCode}>{item.code}</Text>
        <Text style={styles.credits}>{item.credits} credits</Text>
      </View>
      <Text style={styles.unitName}>{item.name}</Text>
      {!!item.description && <Text style={styles.meta}>{item.description}</Text>}
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={units}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={units.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Unit Catalog
            </Text>
            <StatusBanner status="real" note="Superadmin only. Units lecturers can attach to their courses." />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}
            {loading && <ActivityIndicator color={colors.primary} style={{ marginBottom: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No units yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityRole="button" accessibilityLabel="Create a new unit">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent>
<KeyboardSafe>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Unit</Text>
            <TextInput style={styles.input} placeholder="Code (e.g. CS101)" placeholderTextColor={colors.textMuted} value={code} onChangeText={setCode} autoCapitalize="characters" />
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="Credits" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={credits} onChangeText={setCredits} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardSafe>
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
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
        unitCode: { fontSize: 13, fontWeight: '800', color: colors.primary },
        credits: { fontSize: 12, color: colors.textMuted },
        unitName: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        deleteButton: { alignSelf: 'flex-start', marginTop: Spacing.sm },
        deleteButtonText: { fontSize: 12, fontWeight: '700', color: colors.danger },
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
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        fabText: { fontSize: 28, color: colors.white, fontWeight: '700', lineHeight: 30 },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalCard: { backgroundColor: colors.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg },
        modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
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
