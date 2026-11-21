import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acknowledgePrivacy, getLegalStatus, getPrivacyNotice, PrivacyNotice } from '../api/legal';
import { useAuthStore } from '../store/authStore';
import { Radius, Spacing, useColors } from '../constants/theme';
import { LegalStatus, needsGate } from '../utils/legalUi';
import PrivacyNoticeView from './PrivacyNoticeView';

// STATUS: REAL. After sign-in, if the server says this person has not confirmed the CURRENT Privacy Notice, a
// full-screen prompt shows the notice and asks them to confirm (the same rule as the website, Kenya's Data Protection
// Act). If the status cannot be loaded (offline, server down) nobody is blocked: an outage must never lock people out.
// An out-of-date confirmation is refused by the server (409); the prompt then reloads the latest version.

export default function PrivacyGate() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const logout = useAuthStore((s) => s.logout);

  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await getLegalStatus());
    } catch {
      setStatus(null); // fail open
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setNotice(null);
      return;
    }
    load();
  }, [userId, load]);

  const open = needsGate(status);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPrivacyNotice()
      .then((n) => {
        if (!cancelled) setNotice(n);
      })
      .catch(() => {
        if (!cancelled) setNotice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, status?.currentVersion]);

  if (!open || !status) return null;
  const first = !status.acknowledgedVersion;

  const confirm = async () => {
    setSaving(true);
    setMessage('');
    try {
      await acknowledgePrivacy(status.currentVersion);
      setStatus({ ...status, needsAcknowledgement: false, acknowledgedVersion: status.currentVersion });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setMessage('The Privacy Notice was just updated. Please read the latest version, then confirm again.');
        await load();
      } else {
        setMessage('We could not save that. Please check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
    head: { paddingHorizontal: Spacing.lg },
    title: { fontSize: 22, fontWeight: '800', color: colors.text },
    intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: Spacing.sm },
    scroll: { flex: 1, marginTop: Spacing.md },
    footer: { padding: Spacing.lg, paddingBottom: Spacing.lg + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    error: { color: colors.danger, fontSize: 13, marginBottom: Spacing.sm },
    primary: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    secondary: { alignItems: 'center', paddingVertical: 12 },
    secondaryText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  });

  return (
    <Modal visible animationType="slide" onRequestClose={() => {}} statusBarTranslucent>
      <View style={styles.screen} accessibilityViewIsModal>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">{first ? 'Before you continue' : 'Our Privacy Notice has changed'}</Text>
          <Text style={styles.intro}>
            {first ? 'Please read the UniLink Privacy Notice. ' : 'We have updated the UniLink Privacy Notice. '}
            It explains what we collect, who can see it, which companies help us run UniLink, how to delete your account, and your rights.
          </Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
          {notice ? <PrivacyNoticeView notice={notice} /> : <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />}
        </ScrollView>
        <View style={styles.footer}>
          {message ? <Text style={styles.error} accessibilityRole="alert">{message}</Text> : null}
          <TouchableOpacity style={styles.primary} onPress={confirm} disabled={saving} accessibilityRole="button">
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'I have read the Privacy Notice'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => logout()} disabled={saving} accessibilityRole="button">
            <Text style={styles.secondaryText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
