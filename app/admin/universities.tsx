import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { StatusBanner } from '../../src/components/StatusBanner';
import { api } from '../../src/api/client';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import KeyboardSafe from '../../src/components/KeyboardSafe';

// STATUS: REAL — POST /api/admin/universities calls the live
// backend, superadmin-only. Create-only, on purpose: no
// GET/PUT/DELETE /admin/universities route exists anywhere in this
// backend, confirmed directly against admin.routes.js rather than
// assumed — so there is genuinely no way to list, edit, or remove a
// university, on web or here. This screen doesn't pretend otherwise
// with a fake list; it's a plain creation form, nothing more.

export default function AdminCreateUniversityScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Name and email required', 'Please fill in both fields.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/universities', { name: name.trim(), email: email.trim(), country: country.trim() });
      Alert.alert('Created', 'University created successfully.');
      setName('');
      setEmail('');
      setCountry('');
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardSafe>
<ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <Text style={styles.title} accessibilityRole="header">
        New University
      </Text>
      <StatusBanner
        status="real"
        note="Superadmin only. Create-only — there is no way to list, edit, or delete universities anywhere in this backend yet."
      />

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
      <TextInput style={styles.input} placeholder="Country (optional)" placeholderTextColor={colors.textMuted} value={country} onChangeText={setCountry} />

      <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Create University</Text>}
      </TouchableOpacity>
    </ScrollView>
</KeyboardSafe>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: Spacing.sm },
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
        saveButton: { backgroundColor: colors.primary, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.md, marginTop: Spacing.lg },
        saveButtonDisabled: { opacity: 0.5 },
        saveButtonText: { fontSize: 15, fontWeight: '700', color: colors.white },
      }),
    [colors]
  );
}
