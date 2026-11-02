import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api/client';
import { Radius, Spacing, useColors } from '../../src/constants/theme';
import { CallAiSheet } from '../../src/calls/CallAiSheet';
import { formatDuration } from '../../src/calls/format';
import { loadLiveKit } from '../../src/calls/native';

// STATUS: REAL on the backend (POST/GET /api/calls...). The live audio and video go through LiveKit
// and need an app BUILT with the call code; on any other build this screen explains that instead
// of crashing. Not yet tried on a real phone from this codebase.
//
// One screen for the whole life of a call:
//   incoming   Accept / Decline
//   calling    "Calling..." with Cancel, until the other person answers
//   active     the live call (voice or video), mute / camera / speaker / AI / End
//   finished   a short message, then back to the chat
//
// The screen polls GET /api/calls/:id every 2 seconds, which is how the caller learns the call was
// answered and how both people learn the other one hung up. No websocket is needed.

type Status = 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'cancelled';

interface CallInfo {
  id: string;
  conversationId: string;
  type: 'voice' | 'video';
  status: Status;
  direction: 'incoming' | 'outgoing';
  otherName: string;
  answeredAt: string | null;
  durationSec: number;
}

interface Join {
  url: string;
  token: string;
}

const POLL_MS = 2000;
const FINISHED: Status[] = ['ended', 'missed', 'declined', 'cancelled'];

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/messages' as any);
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles(colors);

  const [call, setCall] = useState<CallInfo | null>(null);
  const [join, setJoin] = useState<Join | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const statusRef = useRef<Status | null>(null);
  statusRef.current = call?.status ?? null;

  // ---- keep the call fresh
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/calls/${id}`);
      setCall(res.data?.call ?? null);
      if (res.data?.token && res.data?.url) setJoin((j) => j ?? { url: res.data.url, token: res.data.token });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setProblem('This call is no longer available.');
      }
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (statusRef.current && FINISHED.includes(statusRef.current)) return;
      refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // ---- leave a moment after it finishes
  useEffect(() => {
    if (!call || !FINISHED.includes(call.status)) return undefined;
    const t = setTimeout(leave, call.status === 'ended' ? 1500 : 1800);
    return () => clearTimeout(t);
  }, [call]);

  useEffect(() => {
    if (!problem) return undefined;
    const t = setTimeout(leave, 2500);
    return () => clearTimeout(t);
  }, [problem]);

  // If the screen is closed while the call is live (a crash of navigation, a swipe), hang up, so
  // nobody is left "busy" with a call that has no screen.
  useEffect(() => {
    return () => {
      const s = statusRef.current;
      if (id && (s === 'active' || s === 'ringing')) api.post(`/calls/${id}/end`).catch(() => {});
    };
  }, [id]);

  // ---- actions
  const act = async (path: string, after?: (data: any) => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/calls/${id}/${path}`);
      after?.(res.data);
    } catch (err: any) {
      Alert.alert('Call', err?.response?.data?.message || 'That did not work. Try again.');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const accept = () =>
    act('accept', (data) => {
      if (data?.call) setCall(data.call);
      if (data?.token && data?.url) setJoin({ url: data.url, token: data.token });
    });
  const decline = () => act('decline', () => leave());
  const hangUp = () => act('end', () => leave());

  // Android back button during a call asks first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (statusRef.current === 'active' || statusRef.current === 'ringing') {
        Alert.alert('End this call?', undefined, [
          { text: 'Stay', style: 'cancel' },
          { text: 'End call', style: 'destructive', onPress: () => hangUp() },
        ]);
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- what to show
  if (problem) {
    return (
      <View style={styles.center}>
        <Text style={styles.big}>{problem}</Text>
      </View>
    );
  }
  if (!call) {
    return (
      <View style={styles.center}>
        <Text style={styles.sub}>Connecting…</Text>
      </View>
    );
  }

  const kind = call.type === 'video' ? 'video' : 'voice';
  const person = call.otherName || 'Someone';

  if (FINISHED.includes(call.status)) {
    const text =
      call.status === 'ended'
        ? `Call ended · ${formatDuration(call.durationSec)}`
        : call.status === 'declined'
          ? call.direction === 'outgoing' ? 'Call declined' : 'You declined'
          : call.status === 'cancelled'
            ? 'Call cancelled'
            : 'No answer';
    return (
      <View style={styles.center}>
        <Avatar name={person} styles={styles} />
        <Text style={styles.name}>{person}</Text>
        <Text style={styles.sub}>{text}</Text>
      </View>
    );
  }

  if (call.status === 'ringing') {
    const incoming = call.direction === 'incoming';
    return (
      <View style={styles.center}>
        <Avatar name={person} styles={styles} />
        <Text style={styles.name}>{person}</Text>
        <Text style={styles.sub}>{incoming ? `Incoming ${kind} call` : `Calling… (${kind})`}</Text>
        <View style={styles.row}>
          {incoming ? (
            <>
              <RoundButton label="Decline" tone="danger" onPress={decline} disabled={busy} styles={styles} />
              <RoundButton label="Accept" tone="ok" onPress={accept} disabled={busy} styles={styles} />
            </>
          ) : (
            <RoundButton label="Cancel" tone="danger" onPress={hangUp} disabled={busy} styles={styles} />
          )}
        </View>
      </View>
    );
  }

  // active
  return (
    <>
      <ActiveCall call={call} join={join} person={person} onEnd={hangUp} onAi={() => setAiOpen(true)} busy={busy} styles={styles} />
      <CallAiSheet visible={aiOpen} onClose={() => setAiOpen(false)} callId={call.id} conversationId={call.conversationId} notes={notes} setNotes={setNotes} />
    </>
  );
}

type Styles = ReturnType<typeof useStyles>;

function Avatar({ name, styles }: { name: string; styles: Styles }) {
  return (
    <View style={styles.avatar} accessibilityElementsHidden>
      <Text style={styles.avatarText}>{(name.trim()[0] || '?').toUpperCase()}</Text>
    </View>
  );
}

function RoundButton({ label, tone, onPress, disabled, styles, onDark }: { label: string; tone: 'ok' | 'danger' | 'plain'; onPress: () => void; disabled?: boolean; styles: Styles; onDark?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, tone === 'plain' && !onDark && styles.roundPrimary, tone === 'ok' && styles.roundOk, tone === 'danger' && styles.roundDanger, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.roundText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------------------------
// The live part. Everything from LiveKit comes through loadLiveKit(), never a top-level import.

function ActiveCall({ call, join, person, onEnd, onAi, busy, styles }: { call: CallInfo; join: Join | null; person: string; onEnd: () => void; onAi: () => void; busy: boolean; styles: Styles }) {
  const native = useMemo(() => loadLiveKit(), []);
  const [perm, setPerm] = useState<'checking' | 'ok' | 'denied'>('checking');

  // Ask for the microphone (and the camera on a video call) before connecting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS !== 'android') {
        if (!cancelled) setPerm('ok');
        return;
      }
      const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(call.type === 'video' ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
      const result = await PermissionsAndroid.requestMultiple(wanted);
      const allowed = wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
      if (!cancelled) setPerm(allowed ? 'ok' : 'denied');
    })().catch(() => !cancelled && setPerm('denied'));
    return () => {
      cancelled = true;
    };
  }, [call.type]);

  // Route audio like a phone call: earpiece for voice, speaker for video.
  useEffect(() => {
    if (!native || perm !== 'ok') return undefined;
    const { AudioSession, AndroidAudioTypePresets } = native.rn;
    let started = false;
    (async () => {
      try {
        await AudioSession.configureAudio({
          android: { preferredOutputList: ['bluetooth', 'headset', call.type === 'video' ? 'speaker' : 'earpiece'], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios: { defaultOutput: call.type === 'video' ? 'speaker' : 'earpiece' },
        });
        await AudioSession.startAudioSession();
        started = true;
      } catch {
        // The call still connects; only the routing choice is lost.
      }
    })();
    return () => {
      if (started) AudioSession.stopAudioSession().catch(() => {});
    };
  }, [native, perm, call.type]);

  if (!native) {
    return (
      <View style={styles.center}>
        <Text style={styles.big}>This version of the app can't take calls.</Text>
        <Text style={styles.sub}>Install the latest UniLink from the download page, then try again.</Text>
        <View style={styles.row}>
          <RoundButton label="End call" tone="danger" onPress={onEnd} disabled={busy} styles={styles} />
        </View>
      </View>
    );
  }

  if (perm === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.big}>UniLink needs {call.type === 'video' ? 'the microphone and camera' : 'the microphone'}.</Text>
        <Text style={styles.sub}>Allow it in Settings, then call again.</Text>
        <View style={styles.row}>
          <RoundButton label="Open Settings" tone="plain" onPress={() => Linking.openSettings()} styles={styles} />
          <RoundButton label="End call" tone="danger" onPress={onEnd} disabled={busy} styles={styles} />
        </View>
      </View>
    );
  }

  if (!join || perm === 'checking') {
    return (
      <View style={styles.center}>
        <Avatar name={person} styles={styles} />
        <Text style={styles.name}>{person}</Text>
        <Text style={styles.sub}>Connecting…</Text>
      </View>
    );
  }

  const { LiveKitRoom } = native.rn;
  return (
    <LiveKitRoom
      serverUrl={join.url}
      token={join.token}
      connect
      audio
      video={call.type === 'video'}
      onError={(e: Error) => Alert.alert('Call problem', e?.message || 'The connection had a problem.')}
    >
      <RoomView call={call} person={person} native={native} onEnd={onEnd} onAi={onAi} busy={busy} styles={styles} />
    </LiveKitRoom>
  );
}

function RoomView({ call, person, native, onEnd, onAi, busy, styles }: { call: CallInfo; person: string; native: NonNullable<ReturnType<typeof loadLiveKit>>; onEnd: () => void; onAi: () => void; busy: boolean; styles: Styles }) {
  const { useTracks, useLocalParticipant, useRemoteParticipants, VideoTrack, isTrackReference, AudioSession } = native.rn;
  const { Track } = native.client;

  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const remoteCamera = cameraTracks.find((t) => isTrackReference(t) && !t.participant.isLocal);
  const localCamera = cameraTracks.find((t) => isTrackReference(t) && t.participant.isLocal);

  const [speaker, setSpeaker] = useState(call.type === 'video');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = call.answeredAt ? Math.max(0, Math.floor((now - new Date(call.answeredAt).getTime()) / 1000)) : 0;

  // If the other person's phone drops out of the room (a crash, no signal) for 30 seconds, end it
  // rather than leave a silent call running.
  const hadRemote = useRef(false);
  if (remotes.length > 0) hadRemote.current = true;
  useEffect(() => {
    if (!hadRemote.current || remotes.length > 0) return undefined;
    const t = setTimeout(() => {
      Alert.alert('Call', `${person} left the call.`);
      onEnd();
    }, 30000);
    return () => clearTimeout(t);
  }, [remotes.length, person, onEnd]);

  const toggleSpeaker = async () => {
    const next = !speaker;
    setSpeaker(next);
    try {
      if (Platform.OS === 'android') await AudioSession.selectAudioOutput(next ? 'speaker' : 'earpiece');
      else await AudioSession.showAudioRoutePicker();
    } catch {
      // Some devices have no earpiece/speaker choice; ignore.
    }
  };

  const flip = async () => {
    try {
      const publication = localParticipant.getTrackPublication(Track.Source.Camera);
      const next = facing === 'user' ? 'environment' : 'user';
      await publication?.videoTrack?.restartTrack({ facingMode: next });
      setFacing(next);
    } catch {
      Alert.alert('Camera', 'Could not switch the camera.');
    }
  };

  const video = call.type === 'video';

  return (
    <View style={styles.live}>
      {video && remoteCamera && isTrackReference(remoteCamera) ? (
        <VideoTrack trackRef={remoteCamera} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.center}>
          <Avatar name={person} styles={styles} />
          <Text style={styles.name}>{person}</Text>
          <Text style={styles.sub}>{remotes.length === 0 ? 'Waiting for them to join…' : formatDuration(seconds)}</Text>
        </View>
      )}

      {video && remoteCamera ? (
        <View style={styles.topBar}>
          <Text style={styles.nameSmall}>{person}</Text>
          <Text style={styles.subSmall}>{formatDuration(seconds)}</Text>
        </View>
      ) : null}

      {video && localCamera && isTrackReference(localCamera) && isCameraEnabled ? (
        <View style={styles.pip}>
          <VideoTrack trackRef={localCamera} style={styles.pipVideo} objectFit="cover" mirror={facing === 'user'} />
        </View>
      ) : null}

      <View style={styles.controls}>
        <RoundButton label={isMicrophoneEnabled ? 'Mute' : 'Unmute'} tone="plain" onDark onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} styles={styles} />
        {video ? <RoundButton label={isCameraEnabled ? 'Camera off' : 'Camera on'} tone="plain" onDark onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)} styles={styles} /> : null}
        {video ? <RoundButton label="Flip" tone="plain" onDark onPress={flip} styles={styles} /> : null}
        <RoundButton label={speaker ? 'Earpiece' : 'Speaker'} tone="plain" onDark onPress={toggleSpeaker} styles={styles} />
        <RoundButton label="AI" tone="plain" onDark onPress={onAi} styles={styles} />
        <RoundButton label="End" tone="danger" onPress={onEnd} disabled={busy} styles={styles} />
      </View>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useColors>) {
  return useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: Spacing.xl, gap: Spacing.md },
        live: { flex: 1, backgroundColor: '#0b0f14' },
        remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: colors.white, fontSize: 44, fontWeight: '800' },
        name: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
        big: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
        sub: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
        nameSmall: { color: '#fff', fontSize: 16, fontWeight: '800' },
        subSmall: { color: '#e5e7eb', fontSize: 13 },
        topBar: { position: 'absolute', top: Spacing.lg, left: Spacing.md, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
        pip: { position: 'absolute', top: Spacing.lg, right: Spacing.md, width: 110, height: 150, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
        pipVideo: { flex: 1 },
        row: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
        controls: { position: 'absolute', bottom: Spacing.xl, left: 0, right: 0, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingHorizontal: Spacing.md },
        round: { minWidth: 76, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center' },
        roundPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
        roundOk: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
        roundDanger: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
        roundText: { color: '#fff', fontWeight: '800', fontSize: 14 },
      }),
    [colors]
  );
}
