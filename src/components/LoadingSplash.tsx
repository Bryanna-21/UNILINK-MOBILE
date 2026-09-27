import { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

// STATUS: REAL — shown while the app waits on its first API call
// after a cold start (Render free tier can take up to 60s to wake —
// see client.ts's COLD_START_TIMEOUT_MS). Fixed light background,
// matching the current single logo asset (light-theme only as of
// tonight's asset swap). If/when a dark-mode logo variant exists,
// this can be made theme-aware via useThemeStore — not done now
// since there is only one asset to show.
//
// Three dots glow blue in sequence, left to right, looping — pure
// Animated.timing on opacity, no new package required.

const DOT_COUNT = 3;
const CYCLE_MS = 1400;

export function LoadingSplash() {
  const dotAnims = useRef([...Array(DOT_COUNT)].map(() => new Animated.Value(0.25))).current;

  useEffect(() => {
    const animations = dotAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay((CYCLE_MS / DOT_COUNT) * i),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: CYCLE_MS / 2,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.25,
              duration: CYCLE_MS / 2,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ])
    );
    Animated.parallel(animations).start();
  }, [dotAnims]);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <View style={styles.dotsRow}>
        {dotAnims.map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 150,
    marginBottom: 48,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
