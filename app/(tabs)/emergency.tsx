import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { api } from '../../src/api/client';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Colors, Radius, Spacing } from '../../src/constants/theme';

// STATUS: REAL — calls POST /api/emergency/report on the live backend.
// type must be exactly "medical" | "safety" | "abuse" (enforced by the
// backend controller). Live location, trusted contacts, campus security
// integration, and the SOS button from the spec are NOT built — this
// is a plain report-submission form only.

const EMERGENCY_TYPES = [
  { value: 'medical', label: '🏥 Medical' },
  { value: 'safety', label: '⚠️ Safety' },
  { value: 'abuse', label: '🚫 Abuse' },
] as const;

export default function EmergencyScreen() {
  const [type, setType] = useState<'medical' | 'safety' | 'abuse' | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!type) {
      Alert.alert('Select a type', 'Please choose what kind of emergency this is.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/emergency/report', { type, message: message.trim() || undefined });
      Alert.alert('Report sent', 'Your emergency report has been submitted.');
      setType(null);
      setMessage('');
    } catch (err: any) {
      Alert.alert(
        'Could not submit',
        err?.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBanner
        status="real"
        note="Submits to the real backend. Live location & trusted contacts are not built yet."
      />

      <Text style={styles.title}>Report an Emergency</Text>

      <View style={styles.typeRow}>
        {EMERGENCY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeButton, type === t.value && styles.typeButtonActive]}
            onPress={() => setType(t.value)}
          >
            <Text
              style={[
                styles.typeButtonText,
                type === t.value && styles.typeButtonTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.messageInput}
        placeholder="Describe what's happening (optional)"
        placeholderTextColor={Colors.textMuted}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.submitButton, (!type || isSubmitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!type || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>Submit Report</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: Colors.danger,
    backgroundColor: '#FEF2F2',
  },
  typeButtonText: {
    fontSize: 13,
    color: Colors.text,
  },
  typeButtonTextActive: {
    color: Colors.danger,
    fontWeight: '700',
  },
  messageInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
