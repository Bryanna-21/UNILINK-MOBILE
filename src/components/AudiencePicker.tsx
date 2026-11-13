import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Radius, Spacing, useColors } from '../constants/theme';
import {
  AUDIENCE_OPTIONS,
  AudienceKind,
  AudienceValue,
  PickedPerson,
  PickedUniversity,
  audienceIsComplete,
} from '../utils/audience';

// STATUS: REAL. "Who can see this?" for a new post: Everyone, My university, Chosen universities, Followers,
// Friends, or Specific people. The two list choices open a finder:
//   - universities: GET /auth/universities?search= (type 3+ letters)
//   - people: the people you follow are listed at once (GET /follow/:me/following); GET /people/search?q= finds
//     anyone else on UniLink by username (3+ characters).
// The server enforces the choice (feed, profile, comments, likes); this screen only collects it.

const MAX_UNIVERSITIES = 50;
const MAX_PEOPLE = 100;

interface Props {
  visible: boolean;
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  onClose: () => void;
}

export default function AudiencePicker({ visible, value, onChange, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);
  const myId = me?.id;

  const [uniQuery, setUniQuery] = useState('');
  const [uniResults, setUniResults] = useState<PickedUniversity[]>([]);
  const [uniBusy, setUniBusy] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<PickedPerson[]>([]);
  const [personBusy, setPersonBusy] = useState(false);
  const [following, setFollowing] = useState<PickedPerson[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const uniRequest = useRef(0);
  const personRequest = useRef(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          maxHeight: '90%',
        },
        grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: Spacing.md },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
        title: { fontSize: 20, fontWeight: '800', color: colors.text },
        done: { fontSize: 15, fontWeight: '800', color: colors.primary, padding: Spacing.sm },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          padding: Spacing.md,
          marginTop: Spacing.sm,
        },
        rowOn: { borderColor: colors.primary, borderWidth: 2 },
        icon: { fontSize: 24 },
        label: { fontSize: 15, fontWeight: '700', color: colors.text },
        hint: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
        radio: { fontSize: 18, color: colors.primary, fontWeight: '800' },
        finder: { marginTop: Spacing.md },
        finderTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 6 },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.text,
        },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
        chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10 },
        chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', maxWidth: 220 },
        chipX: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
        result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        resultName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
        resultSub: { fontSize: 12, color: colors.textMuted },
        add: { fontSize: 13, fontWeight: '800', color: colors.primary, paddingLeft: Spacing.md },
        added: { fontSize: 13, fontWeight: '800', color: colors.textMuted, paddingLeft: Spacing.md },
        empty: { fontSize: 13, color: colors.textMuted, marginTop: Spacing.sm },
        note: { fontSize: 13, color: colors.danger, marginTop: Spacing.sm },
      }),
    [colors]
  );

  // Clear the finders each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setNote(null);
      setUniQuery('');
      setUniResults([]);
      setPersonQuery('');
      setPersonResults([]);
    }
  }, [visible]);

  // The people you follow, loaded once, the first time "Specific people" is chosen.
  useEffect(() => {
    if (!visible || value.kind !== 'people' || followingLoaded || !myId) return;
    let cancelled = false;
    api
      .get(`/follow/${myId}/following`)
      .then((res) => {
        if (cancelled) return;
        setFollowing(((res.data?.data ?? []) as any[]).map((u) => ({ _id: String(u._id), name: u.name, username: u.username })));
        setFollowingLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFollowingLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, value.kind, followingLoaded, myId]);

  // Search universities (3+ letters). Only the newest request may update the list.
  useEffect(() => {
    const term = uniQuery.trim();
    if (value.kind !== 'universities' || term.length < 3) {
      setUniResults([]);
      return;
    }
    const id = ++uniRequest.current;
    setUniBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/auth/universities', { params: { search: term } });
        if (id === uniRequest.current) setUniResults(((res.data?.data ?? []) as any[]).map((u) => ({ _id: String(u._id), name: u.name })));
      } catch {
        if (id === uniRequest.current) setUniResults([]);
      } finally {
        if (id === uniRequest.current) setUniBusy(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [uniQuery, value.kind]);

  // Search people by username (3+ characters).
  useEffect(() => {
    const term = personQuery.trim().replace(/^@+/, '');
    if (value.kind !== 'people' || term.length < 3) {
      setPersonResults([]);
      return;
    }
    const id = ++personRequest.current;
    setPersonBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/people/search', { params: { q: term } });
        if (id === personRequest.current) setPersonResults(((res.data?.data ?? []) as any[]).map((u) => ({ _id: String(u._id), name: u.name, username: u.username })));
      } catch {
        if (id === personRequest.current) setPersonResults([]);
      } finally {
        if (id === personRequest.current) setPersonBusy(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personQuery, value.kind]);

  const choose = (kind: AudienceKind) => {
    setNote(null);
    onChange({ ...value, kind });
  };

  const addUniversity = (u: PickedUniversity) => {
    if (value.universities.some((x) => x._id === u._id)) return;
    if (value.universities.length >= MAX_UNIVERSITIES) {
      setNote(`You can choose up to ${MAX_UNIVERSITIES} universities.`);
      return;
    }
    onChange({ ...value, universities: [...value.universities, u] });
  };
  const removeUniversity = (id: string) => onChange({ ...value, universities: value.universities.filter((u) => u._id !== id) });

  const addPerson = (p: PickedPerson) => {
    if (value.people.some((x) => x._id === p._id)) return;
    if (value.people.length >= MAX_PEOPLE) {
      setNote(`You can choose up to ${MAX_PEOPLE} people.`);
      return;
    }
    onChange({ ...value, people: [...value.people, p] });
  };
  const removePerson = (id: string) => onChange({ ...value, people: value.people.filter((p) => p._id !== id) });

  const finish = () => {
    if (!audienceIsComplete(value)) {
      setNote(value.kind === 'universities' ? 'Choose at least one university, or pick another audience.' : 'Choose at least one person, or pick another audience.');
      return;
    }
    onClose();
  };

  const personRows = (list: PickedPerson[]) =>
    list.map((p) => {
      const picked = value.people.some((x) => x._id === p._id);
      return (
        <TouchableOpacity key={p._id} style={styles.result} onPress={() => (picked ? removePerson(p._id) : addPerson(p))} accessibilityRole="button" accessibilityLabel={`${picked ? 'Remove' : 'Add'} ${p.name}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
            {p.username ? <Text style={styles.resultSub}>@{p.username}</Text> : null}
          </View>
          <Text style={picked ? styles.added : styles.add}>{picked ? 'Added ✓' : 'Add'}</Text>
        </TouchableOpacity>
      );
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={finish} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title} accessibilityRole="header">Who can see this?</Text>
            <TouchableOpacity onPress={finish} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {AUDIENCE_OPTIONS.map((o) => {
              const on = value.kind === o.kind;
              return (
                <TouchableOpacity key={o.kind} style={[styles.row, on && styles.rowOn]} onPress={() => choose(o.kind)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${o.label}. ${o.hint}`}>
                  <Text style={styles.icon}>{o.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{o.label}</Text>
                    <Text style={styles.hint}>{o.hint}</Text>
                  </View>
                  <Text style={styles.radio}>{on ? '●' : '○'}</Text>
                </TouchableOpacity>
              );
            })}

            {value.kind === 'universities' && (
              <View style={styles.finder}>
                <Text style={styles.finderTitle}>Find universities</Text>
                <TextInput style={styles.input} value={uniQuery} onChangeText={setUniQuery} placeholder="Type at least 3 letters" placeholderTextColor={colors.textMuted} autoCorrect={false} accessibilityLabel="Search universities" />
                {value.universities.length > 0 && (
                  <View style={styles.chips}>
                    {value.universities.map((u) => (
                      <TouchableOpacity key={u._id} style={styles.chip} onPress={() => removeUniversity(u._id)} accessibilityRole="button" accessibilityLabel={`Remove ${u.name}`}>
                        <Text style={styles.chipText} numberOfLines={1}>{u.name}</Text>
                        <Text style={styles.chipX}>✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {uniBusy ? <ActivityIndicator style={{ marginTop: Spacing.sm }} color={colors.primary} /> : null}
                {uniResults.map((u) => {
                  const picked = value.universities.some((x) => x._id === u._id);
                  return (
                    <TouchableOpacity key={u._id} style={styles.result} onPress={() => (picked ? removeUniversity(u._id) : addUniversity(u))} accessibilityRole="button">
                      <Text style={styles.resultName} numberOfLines={2}>{u.name}</Text>
                      <Text style={picked ? styles.added : styles.add}>{picked ? 'Added ✓' : 'Add'}</Text>
                    </TouchableOpacity>
                  );
                })}
                {uniQuery.trim().length >= 3 && !uniBusy && uniResults.length === 0 ? <Text style={styles.empty}>No university matches that.</Text> : null}
                <Text style={styles.empty}>Your own university is not included unless you add it.</Text>
              </View>
            )}

            {value.kind === 'people' && (
              <View style={styles.finder}>
                <Text style={styles.finderTitle}>Find people</Text>
                <TextInput style={styles.input} value={personQuery} onChangeText={setPersonQuery} placeholder="Search by username (3+ characters)" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search people" />
                {value.people.length > 0 && (
                  <View style={styles.chips}>
                    {value.people.map((p) => (
                      <TouchableOpacity key={p._id} style={styles.chip} onPress={() => removePerson(p._id)} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`}>
                        <Text style={styles.chipText} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.chipX}>✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {personBusy ? <ActivityIndicator style={{ marginTop: Spacing.sm }} color={colors.primary} /> : null}
                {personRows(personResults)}
                {personQuery.trim().replace(/^@+/, '').length >= 3 && !personBusy && personResults.length === 0 ? <Text style={styles.empty}>Nobody found with that username.</Text> : null}
                {personQuery.trim().replace(/^@+/, '').length < 3 && (
                  <>
                    <Text style={[styles.finderTitle, { marginTop: Spacing.md }]}>People you follow</Text>
                    {!followingLoaded ? <ActivityIndicator color={colors.primary} /> : following.length === 0 ? <Text style={styles.empty}>You do not follow anyone yet. Search by username above.</Text> : personRows(following)}
                  </>
                )}
              </View>
            )}

            {note ? <Text style={styles.note}>{note}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
