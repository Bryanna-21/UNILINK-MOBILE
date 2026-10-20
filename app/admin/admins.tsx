import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — GET/POST /api/admin/admins, PUT/DELETE
// /api/admin/admins/:id all call the live backend, superadmin-only
// (see admin.routes.js's requireSuperadmin on this whole surface).
//
// updateAdmin and deleteAdmin were both fixed today: they previously
// mutated (update/delete) the User document FIRST and only checked
// role === "admin" on the result afterward — meaning a wrong id
// could silently edit or permanently delete a student, lecturer, or
// even a superadmin, then report "Admin not found" as if nothing had
// happened. Both now verify the role before touching anything.

interface Admin {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

function capitalize(v?: string) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Unknown';
}

export default function AdminManagementScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/admin/admins');
      setAdmins(res.data?.data ?? []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load admins.');
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
    setEditingAdmin(null);
    setName('');
    setEmail('');
    setPassword('');
    setFormVisible(true);
  };

  const openEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setName(admin.name);
    setEmail(admin.email);
    setPassword('');
    setFormVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Name and email required', 'Please fill in both fields.');
      return;
    }
    if (!editingAdmin && !password.trim()) {
      Alert.alert('Password required', 'A password is required to create a new admin.');
      return;
    }
    setSaving(true);
    try {
      if (editingAdmin) {
        await api.put(`/admin/admins/${editingAdmin.id}`, { name: name.trim(), email: email.trim() });
      } else {
        await api.post('/admin/admins', { name: name.trim(), email: email.trim(), password });
      }
      setFormVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (admin: Admin) => {
    Alert.alert(
      'Delete this admin?',
      `"${admin.name}" (${admin.email}) will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/admins/${admin.id}`);
              load();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.response?.data?.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Admin }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.adminName}>{item.name}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{capitalize(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{item.email}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionChip} onPress={() => openEdit(item)}>
          <Text style={styles.actionChipText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionChip, styles.dangerChip]} onPress={() => handleDelete(item)}>
          <Text style={[styles.actionChipText, styles.dangerChipText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={admins}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        contentContainerStyle={admins.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.title} accessibilityRole="header">
              Admin Management
            </Text>
            <StatusBanner status="real" note="Superadmin only. Create, edit, and delete administrator accounts." />
            {loadError && <Text style={styles.errorText}>{loadError}</Text>}
            {loading && <ActivityIndicator color={colors.primary} style={{ marginBottom: Spacing.md }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No admins yet.</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityRole="button" accessibilityLabel="Create a new admin">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent>
<KeyboardSafe>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingAdmin ? 'Edit Admin' : 'New Admin'}</Text>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {!editingAdmin && (
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
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
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        adminName: { fontSize: 15, fontWeight: '700', color: colors.text },
        statusBadge: { backgroundColor: colors.secondary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
        statusBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
        meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        actionsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
        actionChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
        actionChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        dangerChip: { borderColor: colors.danger },
        dangerChipText: { color: colors.danger },
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
