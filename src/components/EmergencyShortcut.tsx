import { TouchableOpacity, StyleSheet } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useColors, Spacing } from '../constants/theme';

// STATUS: REAL. A small red shield button that opens the Emergency screen.
// It is mounted by app/(tabs)/_layout.tsx, NOT by the screens themselves, so protected
// screens (messages.tsx etc.) stay untouched. To show it on more tabs, add the tab's
// route name to VISIBLE_ON. Bottom-LEFT on purpose: Messages already has the AI
// button at bottom-right.
const VISIBLE_ON = ['messages'];

export function EmergencyShortcut() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const current = segments[segments.length - 1];
  if (!VISIBLE_ON.includes(current)) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/emergency' as any)}
      accessibilityRole="button"
      accessibilityLabel="Emergency and SOS"
      style={[
        styles.button,
        { backgroundColor: colors.danger, left: Spacing.md, bottom: insets.bottom + 56 + Spacing.lg },
      ]}
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2}>
        <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM12 8v5M12 16v.5" />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
});
