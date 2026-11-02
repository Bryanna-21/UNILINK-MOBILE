import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api/client';
import { Radius, Spacing, useColors } from '../constants/theme';
import { useCallsAvailable } from './useCallsAvailable';

// The two buttons in a chat header: voice call and video call. They render nothing unless calls are
// switched on, this build supports them, and the chat is one-to-one.
export function CallButtons({ conversationId, enabled }: { conversationId?: string; enabled: boolean }) {
  const colors = useColors();
  const available = useCallsAvailable();
  const [starting, setStarting] = useState(false);

  if (!available || !enabled || !conversationId) return null;

  const start = async (type: 'voice' | 'video') => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await api.post('/calls', { conversationId, type });
      const id = res.data?.call?.id;
      if (id) router.push(`/call/${id}` as any);
    } catch (err: any) {
      Alert.alert('Could not start the call', err?.response?.data?.message || 'Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  };

  const button = [styles.button, { backgroundColor: colors.surface, borderColor: colors.border }, starting && { opacity: 0.5 }];

  return (
    <View style={styles.row}>
      <TouchableOpacity style={button} onPress={() => start('voice')} disabled={starting} accessibilityRole="button" accessibilityLabel="Start a voice call">
        <Text style={styles.glyph}>{'\uD83D\uDCDE'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={button} onPress={() => start('video')} disabled={starting} accessibilityRole="button" accessibilityLabel="Start a video call">
        <Text style={styles.glyph}>{'\uD83C\uDFA5'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, marginLeft: 'auto' },
  button: { width: 40, height: 40, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 18 },
});
