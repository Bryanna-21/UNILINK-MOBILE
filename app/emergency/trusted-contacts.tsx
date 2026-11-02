import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import KeyboardSafe from '../../src/components/KeyboardSafe';
import { useColors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — GET/POST/DELETE /api/profile/trusted-contacts.
//
// The people texted when this student sends an SOS. A contact does not need a UniLink account (a
// parent, a sibling): just a name and a phone number that can receive an SMS. The server checks
// the number, keeps at most 5 contacts and refuses duplicates; this screen shows its message.

const MAX_CONTACTS = 5;

interface TrustedContact {
  _id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export default function TrustedContactsScreen() {
  const colors = useColors();
  const styles = useStyles(colors);

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get('/profile/trusted-contacts');
      setContacts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Could not load your trusted contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const full = contacts.length >= MAX_CONTACTS;
  const canSave = !saving && !full && name.trim().length > 0 && phone.trim().length > 0;

  const add = async () => {
    if (!canSave) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.post('/profile/trusted-contacts', {
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim() || undefined,
      });
      setContacts(Array.isArray(res.data?.data) ? res.data.data : contacts);
      setName('');
      setPhone('');
      setRelationship('');
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Could not save the contact.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (contact: TrustedContact) => {
    Alert.alert('Remove contact', `${contact.name} will no longer be texted when you send an SOS.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.delete(`/profile/trusted-contacts/${contact._id}`);
            setContacts(Array.isArray(res.data?.data) ? res.data.data : contacts.filter((c) => c._id !== contact._id));
          } catch (err: any) {
            Alert.alert('Could not remove', err?.response?.data?.message || 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardSafe>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Trusted contacts
        </Text>
        <StatusBanner status="real" note="Saved to the real backend." />
        <Text style={styles.help}>
          These people are texted when you send an SOS. Use a number that can receive an SMS, for example 0712345678.
          You can add up to {MAX_CONTACTS}.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
        ) : loadError ? (
          <View>
            <Text style={styles.error}>{loadError}</Text>
            <TouchableOpacity onPress={load} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : contacts.length === 0 ? (
          <Text style={styles.empty}>No trusted contacts yet. Add the people you would want told in an emergency.</Text>
        ) : (
          contacts.map((c) => (
            <View key={c._id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>
                  {c.phone}
                  {c.relationship ? ` · ${c.relationship}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(c)} accessibilityRole="button" accessibilityLabel={`Remove ${c.name}`} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>{full ? `You have ${MAX_CONTACTS} contacts` : 'Add a contact'}</Text>
        {full ? (
          <Text style={styles.help}>Remove one to add another.</Text>
        ) : (
          <>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
              style={styles.input}
              accessibilityLabel="Contact name"
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={20}
              style={styles.input}
              accessibilityLabel="Contact phone number"
            />
            <TextInput
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Relationship (optional)"
              placeholderTextColor={colors.textMuted}
              maxLength={30}
              style={styles.input}
              accessibilityLabel="Relationship, optional"
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <TouchableOpacity
              onPress={add}
              disabled={!canSave}
              style={[styles.primary, !canSave && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Add trusted contact"
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Add contact</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardSafe>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl },
        title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
        help: { fontSize: 13, color: colors.textMuted, marginBottom: Spacing.md, lineHeight: 19 },
        empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.md,
          marginBottom: Spacing.sm,
        },
        name: { fontSize: 15, fontWeight: '700', color: colors.text },
        meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
        remove: { color: colors.danger, fontWeight: '700', fontSize: 13 },
        sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          fontSize: 15,
          color: colors.text,
          marginBottom: Spacing.sm,
        },
        error: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
        primary: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
        primaryText: { color: colors.white, fontWeight: '800', fontSize: 15 },
        secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        secondaryText: { color: colors.text, fontWeight: '700' },
      }),
    [colors]
  );
}
