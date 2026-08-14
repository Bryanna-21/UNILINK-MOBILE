import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../constants/theme';

interface StatusBannerProps {
  status: 'real' | 'shell';
  note?: string;
}

/**
 * Visible-in-app marker for feature status. This is not decorative —
 * it exists so nobody (including future-you) mistakes a UI shell for
 * a working feature just because it renders correctly. Remove this
 * banner from a screen ONLY when its backend calls are genuinely real.
 */
export function StatusBanner({ status, note }: StatusBannerProps) {
  const isShell = status === 'shell';
  return (
    <View style={[styles.banner, isShell ? styles.shellBanner : styles.realBanner]}>
      <Text style={styles.bannerText}>
        {isShell ? '🚧 UI SHELL — not connected to a real backend' : '✅ LIVE — connected to real backend'}
      </Text>
      {note ? <Text style={styles.bannerNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  shellBanner: {
    backgroundColor: '#FEF3C7',
  },
  realBanner: {
    backgroundColor: '#DCFCE7',
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350F',
  },
  bannerNote: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
});
