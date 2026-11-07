import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Vibration, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useColors, Radius, Spacing } from '../../src/constants/theme';
import { alertTitle, dialable, isPhone, parseNumbers, EmergencyNumber } from '../../src/utils/emergencyAlert';

// STATUS: REAL. The screen an emergency alert opens: who needs help, where, and one tap to call
// them or the country's emergency number. For an alert that rings, the phone also vibrates until
// you silence it (the loud sound itself comes from the "Emergency alerts" notification channel).
// An emergency number can only be dialled, never rung: it opens your phone's dialler.

const RING_PATTERN = [0, 800, 500]; // vibrate 0.8s, pause 0.5s, repeat
const STAFF = ['lecturer', 'admin'];

type Params = {
  reportId?: string;
  kind?: string;
  ring?: string;
  student?: string;
  message?: string;
  location?: string;
  phone?: string;
  numbers?: string;
};

export default function EmergencyAlertScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<Params>();
  const role = useAuthStore((s) => s.user?.role ?? '');

  const kind = typeof params.kind === 'string' ? params.kind : '';
  const student = typeof params.student === 'string' ? params.student : '';
  const message = typeof params.message === 'string' ? params.message : '';
  const location = typeof params.location === 'string' ? params.location : '';
  const reportId = typeof params.reportId === 'string' ? params.reportId : '';
  const ringing = params.ring === '1';

  const [vibrating, setVibrating] = useState(ringing);
  const [numbers, setNumbers] = useState<EmergencyNumber[]>(() => parseNumbers(params.numbers));

  const silence = useCallback(() => {
    try {
      Vibration.cancel();
    } catch {
      // nothing to stop
    }
    setVibrating(false);
  }, []);

  // Vibrate until silenced, left or closed.
  useEffect(() => {
    if (!ringing || !vibrating) return undefined;
    try {
      Vibration.vibrate(RING_PATTERN, true);
    } catch {
      // some devices refuse; the sound still comes from the notification
    }
    return () => {
      try {
        Vibration.cancel();
      } catch {
        // already stopped
      }
    };
  }, [ringing, vibrating]);

  // Opened from the notification list, the numbers are not in the link: ask for them.
  useEffect(() => {
    if (numbers.length > 0 || kind === 'abuse') return;
    let cancelled = false;
    api
      .get('/emergency/numbers')
      .then((res) => {
        if (!cancelled) setNumbers(parseNumbers(JSON.stringify(res.data?.data?.numbers ?? [])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = (value: string) => {
    Linking.openURL(`tel:${dialable(value)}`).catch(() => {});
  };

  const close = () => {
    silence();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home' as any);
  };

  const openReport = () => {
    silence();
    const path = role === 'admin' ? `/admin/report/${reportId}` : `/lecturer/report/${reportId}`;
    router.replace(path as any);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: '#7F1D1D' },
        content: { padding: Spacing.lg, paddingTop: Spacing.xl * 2, gap: Spacing.md },
        badge: { color: '#FECACA', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
        title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
        card: { backgroundColor: '#FFFFFF', borderRadius: Radius.md, padding: Spacing.md, gap: 6 },
        line: { color: '#1E293B', fontSize: 16, lineHeight: 22 },
        strong: { fontWeight: '800' },
        callPrimary: { backgroundColor: '#FFFFFF', borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center' },
        callPrimaryText: { color: '#991B1B', fontSize: 18, fontWeight: '800' },
        call: { borderWidth: 2, borderColor: '#FFFFFF', borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
        callText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
        callLabel: { color: '#FECACA', fontSize: 12, marginTop: 2 },
        row: { flexDirection: 'row', gap: Spacing.sm },
        ghost: { flex: 1, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
        ghostText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
      }),
    []
  );

  const title = alertTitle(kind, student);
  const phone = typeof params.phone === 'string' ? params.phone : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.badge} accessibilityRole="header">
        EMERGENCY
      </Text>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.card} accessible accessibilityLiveRegion="assertive">
        {kind === 'abuse' ? (
          <Text style={styles.line}>A confidential report was filed. Open it to read the details.</Text>
        ) : (
          <>
            {student ? (
              <Text style={styles.line}>
                <Text style={styles.strong}>{student}</Text> needs help.
              </Text>
            ) : null}
            {message ? <Text style={styles.line}>{message}</Text> : null}
            {location ? <Text style={styles.line}>Location: {location}</Text> : null}
            {!student && !message && !location ? <Text style={styles.line}>Open the report for details.</Text> : null}
          </>
        )}
      </View>

      {isPhone(phone) ? (
        <TouchableOpacity style={styles.callPrimary} onPress={() => call(phone)} accessibilityRole="button" accessibilityLabel={`Call ${student || 'them'}`}>
          <Text style={styles.callPrimaryText}>Call {student || 'them'}</Text>
        </TouchableOpacity>
      ) : null}

      {numbers.map((n) => (
        <TouchableOpacity key={n.number} style={styles.call} onPress={() => call(n.number)} accessibilityRole="button" accessibilityLabel={`Call ${n.number}, ${n.label}`}>
          <Text style={styles.callText}>Call {n.number}</Text>
          <Text style={styles.callLabel}>{n.label}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.row}>
        {ringing && vibrating ? (
          <TouchableOpacity style={styles.ghost} onPress={silence} accessibilityRole="button">
            <Text style={styles.ghostText}>Silence</Text>
          </TouchableOpacity>
        ) : null}
        {STAFF.includes(role) && ID_OK(reportId) ? (
          <TouchableOpacity style={styles.ghost} onPress={openReport} accessibilityRole="button">
            <Text style={styles.ghostText}>Open report</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.ghost} onPress={close} accessibilityRole="button">
          <Text style={styles.ghostText}>Close</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const ID_OK = (id: string) => /^[A-Za-z0-9_-]{6,64}$/.test(id);
