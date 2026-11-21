import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPrivacyNotice, PrivacyNotice } from '../../src/api/legal';
import PrivacyNoticeView from '../../src/components/PrivacyNoticeView';
import { Radius, Spacing, useColors } from '../../src/constants/theme';
import { formatDate } from '../../src/utils/legalUi';

// STATUS: REAL. Settings > Privacy Notice: the full notice, any time, with its version and date. The text comes from the
// server (the same as the website), so a wording change never needs an app release.

export default function PrivacyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    getPrivacyNotice().then(setNotice).catch(() => setFailed(true));
  };
  useEffect(load, []);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingTop: insets.top },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { color: colors.primary, fontSize: 16, fontWeight: '700' },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    meta: { fontSize: 13, color: colors.textMuted, marginBottom: Spacing.sm },
    center: { alignItems: 'center', padding: Spacing.xl },
    error: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
    retry: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 20 },
    retryText: { color: '#FFFFFF', fontWeight: '800' },
  });

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Privacy Notice</Text>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}>
        {notice ? (
          <>
            <Text style={styles.meta}>Version {notice.version}{notice.effectiveDate ? ` · ${formatDate(notice.effectiveDate)}` : ''}</Text>
            <PrivacyNoticeView notice={notice} />
          </>
        ) : failed ? (
          <View style={styles.center}>
            <Text style={styles.error}>The Privacy Notice could not be loaded. Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retry} onPress={load} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
        )}
      </ScrollView>
    </View>
  );
}
