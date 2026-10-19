import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { useColors, Radius, Spacing } from '../src/constants/theme';
import { markStandingOpen } from '../src/utils/useAccountBlockRouting';

// STATUS: REAL. Shows the person's account standing (GET /safety/me/standing), every moderation
// decision about them with the reason and the Community Standards section it cites, and lets them
// appeal a decision once (POST /safety/actions/:id/appeal). It stays reachable while the account is
// suspended or closed: that is the point of an appeal. The people who reported or decided are never shown.

interface Block { code: string; message: string; until?: string | null; appealable?: boolean }
interface Appeal { status: string; decision: string | null; decisionReason: string; decidedAt: string | null }
interface Action {
  id: string; actionType: string; label: string; reason: string; policySection: string | null;
  startsAt: string; expiresAt: string | null; status: string; createdAt: string; appeal: Appeal | null; canAppeal: boolean;
}
interface Standing { status: string; block: Block | null; restrictions: { feature: string; label: string; until: string | null }[]; actions: Action[] }

const STATUS_TEXT: Record<string, string> = {
  active: 'In force', expired: 'Ended', revoked: 'Lifted by a moderator', overturned: 'Overturned on appeal',
};
const APPEAL_TEXT: Record<string, string> = {
  pending: 'Your appeal is waiting for a moderator who was not part of the original decision.',
  under_review: 'A moderator is reviewing your appeal.',
  upheld: 'Your appeal was reviewed and the decision stands.',
  overturned: 'Your appeal was successful. The decision was overturned.',
  reduced: 'Your appeal was partly successful. The penalty was shortened.',
};
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function AccountStandingScreen() {
  const colors = useColors();
  const logout = useAuthStore((s) => s.logout);
  const [data, setData] = useState<Standing | null>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    markStandingOpen(true);
    return () => markStandingOpen(false);
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/safety/me/standing');
      setData(res.data?.data ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load your account standing. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Section titles are public and optional: without them the screen still works.
    api.get('/safety/standards')
      .then((r) => {
        const map: Record<string, string> = {};
        for (const s of r.data?.data?.sections ?? []) map[s.id] = `${s.number}. ${s.title}`;
        setSections(map);
      })
      .catch(() => {});
  }, [load]);

  const submit = async (action: Action) => {
    const text = statement.trim();
    if (text.length < 10) {
      Alert.alert('Tell us a little more', 'Please explain in your own words why you disagree (at least 10 characters).');
      return;
    }
    setSending(true);
    try {
      await api.post(`/safety/actions/${action.id}/appeal`, { statement: text });
      setOpenId(null);
      setStatement('');
      await load();
      Alert.alert('Appeal sent', 'A moderator who was not part of the original decision will review it. You will get a notification when it is decided.');
    } catch (e: any) {
      Alert.alert('Could not send your appeal', e?.response?.data?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace('/auth/login' as any);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.md, paddingBottom: Spacing.xl * 2 },
        title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: Spacing.md },
        card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
        blocked: { borderColor: colors.danger, borderWidth: 2 },
        cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
        body: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 },
        muted: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
        sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.sm },
        chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
        chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
        reasonLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 10 },
        appealBox: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 },
        input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.sm, color: colors.text, minHeight: 110, textAlignVertical: 'top' },
        row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        primary: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center' },
        primaryText: { color: colors.white, fontWeight: '700' },
        ghost: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        ghostText: { color: colors.text, fontWeight: '700' },
        link: { color: colors.primary, fontWeight: '700', marginTop: Spacing.sm },
        error: { color: colors.danger, fontSize: 14, marginBottom: Spacing.md },
      }),
    [colors]
  );

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const block = data?.block ?? null;
  const goodStanding = !block && (data?.actions ?? []).every((a) => a.status !== 'active' || a.actionType === 'warning' || a.actionType === 'content_removal') && (data?.restrictions.length ?? 0) === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Account standing</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {block ? (
        <View style={[styles.card, styles.blocked]}>
          <Text style={styles.cardTitle}>{block.code === 'ACCOUNT_TERMINATED' ? 'Your account is closed' : 'Your account is suspended'}</Text>
          <Text style={styles.body}>{block.message}</Text>
          {block.code === 'ACCOUNT_SUSPENDED' && (
            <Text style={styles.muted}>{block.until ? `Your access returns on ${day(block.until)}.` : 'Your account stays suspended until a moderator lifts it.'}</Text>
          )}
        </View>
      ) : data ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{goodStanding ? 'Your account is in good standing' : 'Your account is active'}</Text>
          {(data.restrictions.length ?? 0) > 0 && <Text style={styles.body}>Some features are switched off for now:</Text>}
          {data.restrictions.map((r) => (
            <Text key={r.feature} style={styles.body}>• {r.label}{r.until ? ` until ${day(r.until)}` : ' until a moderator lifts it'}</Text>
          ))}
        </View>
      ) : null}

      {(data?.actions.length ?? 0) > 0 && <Text style={styles.sectionTitle}>DECISIONS ABOUT YOUR ACCOUNT</Text>}
      {data?.actions.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.cardTitle}>{a.label}</Text>
          <Text style={styles.muted}>
            Decided {day(a.createdAt)}{a.expiresAt && a.status === 'active' ? ` · ends ${day(a.expiresAt)}` : ''}
          </Text>
          <View style={styles.chip}><Text style={styles.chipText}>{STATUS_TEXT[a.status] ?? a.status}</Text></View>

          <Text style={styles.reasonLabel}>WHY</Text>
          <Text style={styles.body}>{a.reason}</Text>
          {a.policySection && <Text style={styles.muted}>Community Standards: {sections[a.policySection] ?? a.policySection}</Text>}

          {a.appeal ? (
            <View style={styles.appealBox}>
              <Text style={styles.reasonLabel}>YOUR APPEAL</Text>
              <Text style={styles.body}>{APPEAL_TEXT[a.appeal.status] ?? a.appeal.status}</Text>
              {!!a.appeal.decisionReason && <Text style={styles.body}>{a.appeal.decisionReason}</Text>}
              {a.appeal.decidedAt && <Text style={styles.muted}>Decided {day(a.appeal.decidedAt)}</Text>}
            </View>
          ) : a.canAppeal ? (
            <View style={styles.appealBox}>
              {openId === a.id ? (
                <>
                  <Text style={styles.muted}>Explain in your own words why you disagree. You can appeal each decision once.</Text>
                  <TextInput
                    style={[styles.input, { marginTop: Spacing.sm }]}
                    multiline
                    maxLength={2000}
                    value={statement}
                    onChangeText={setStatement}
                    placeholder="What do you want the reviewer to know?"
                    placeholderTextColor={colors.textMuted}
                    editable={!sending}
                  />
                  <Text style={styles.muted}>{statement.length}/2000</Text>
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.ghost} onPress={() => { setOpenId(null); setStatement(''); }} disabled={sending}>
                      <Text style={styles.ghostText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primary} onPress={() => submit(a)} disabled={sending}>
                      {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Send appeal</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity style={styles.ghost} onPress={() => { setOpenId(a.id); setStatement(''); }} accessibilityRole="button" accessibilityLabel={`Appeal ${a.label}`}>
                  <Text style={styles.ghostText}>Appeal this decision</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      ))}

      <TouchableOpacity onPress={() => router.push('/settings/community-standards' as any)}>
        <Text style={styles.link}>Read the Community Standards</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        {block ? (
          <TouchableOpacity style={styles.ghost} onPress={signOut} accessibilityRole="button">
            <Text style={styles.ghostText}>Sign out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primary} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/campus' as any))} accessibilityRole="button">
            <Text style={styles.primaryText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
