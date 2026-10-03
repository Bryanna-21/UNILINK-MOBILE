import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../constants/theme';

// STATUS: REAL — a profile picture, or when there isn't one (or it fails to load),
// the person's initials on a colour that is stable per name. Decorative on purpose:
// the name is always shown next to it, so screen readers skip the picture.

const PALETTE = ['#0E439C', '#1560C8', '#1387B0', '#0FAFB3', '#152356', '#2F7D6D'];

function initialsOf(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function colorFor(name?: string): string {
  let sum = 0;
  for (const ch of name || '?') sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}

export function Avatar({ name, uri, size = 40 }: { name?: string; uri?: string | null; size?: number }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  const radius = size / 2;

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.border }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  return (
    <View
      style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(name) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: Math.round(size * 0.4) }}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
