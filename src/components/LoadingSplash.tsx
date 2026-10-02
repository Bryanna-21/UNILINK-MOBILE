import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

/**
 * UniLink boot / loading animation.
 *
 * Pure React Native `Animated` API: no new dependencies. Three
 * independent pieces:
 *
 *   1. Logo mark: a soft breathing pulse (scale + opacity loop) with
 *      an expanding ring around it.
 *   2. Wordmark: one fade + rise-in on mount ("Uni" navy, "Link" teal,
 *      matching the logo's own wordmark).
 *   3. Loading dots: three dots pulsing in sequence, looped, shading
 *      from the logo's blue to its teal.
 *
 * HAND-OFF FROM THE NATIVE SPLASH: the OS draws a native splash before any
 * JavaScript runs, and it cannot animate. For the swap to look seamless,
 * this screen uses the same white background and the same logo image at
 * the same size and screen position. Keep LOGO_SIZE equal to
 * `imageWidth` for expo-splash-screen in app.json. The logo is kept at
 * the exact screen centre; the wordmark and dots hang below it.
 *
 * The minimum on-screen time (so a fast start doesn't flash it) is
 * handled by RootLayout in app/_layout.tsx, not here.
 */

const BG = '#FFFFFF';
const BLUE = '#1560C8';
const TEAL = '#0FAFB3';
const NAVY = '#152356';
const WORDMARK_TEAL = '#11A39D';
const DOT_COLORS = ['#0E439C', '#1387B0', '#0FAFB3'];

const LOGO_SIZE = 360; // MUST equal imageWidth in app.json's expo-splash-screen plugin
const RING_SIZE = 250;

export function LoadingSplash() {
  const pulse = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkRise = useRef(new Animated.Value(8)).current;
  const dotAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    // 1. Logo breathing pulse: loops until unmounted.
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 2. Wordmark fades + rises in once, slightly after the logo starts
    //    pulsing so everything doesn't pop in at the same instant.
    const wordmarkIn = Animated.parallel([
      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        duration: 420,
        delay: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkRise, {
        toValue: 0,
        duration: 420,
        delay: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    wordmarkIn.start();

    // 3. Three dots pulsing in a staggered loop.
    const dotLoop = Animated.loop(
      Animated.stagger(
        160,
        dotAnims.map((v) =>
          Animated.sequence([
            Animated.timing(v, {
              toValue: 1,
              duration: 380,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(v, {
              toValue: 0.3,
              duration: 380,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
    dotLoop.start();

    return () => {
      pulseLoop.stop();
      wordmarkIn.stop();
      dotLoop.stop();
    };
  }, [pulse, wordmarkOpacity, wordmarkRise, dotAnims]);

  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const logoOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={styles.root} accessibilityLabel="Loading UniLink" accessibilityRole="progressbar">
      {/* Ring + logo share the exact screen centre, where the native splash drew the logo. */}
      <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />

      <Animated.Text
        style={[
          styles.wordmark,
          { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkRise }] },
        ]}
      >
        <Text style={{ color: NAVY }}>Uni</Text>
        <Text style={{ color: WORDMARK_TEAL }}>Link</Text>
      </Animated.Text>

      <View style={styles.dotsRow}>
        {dotAnims.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: DOT_COLORS[i],
                opacity: v,
                transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.85, 1] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// Same component under the name used in the original NexChat design.
export const BootSplash = LoadingSplash;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: BLUE,
  },
  logo: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  // Wordmark and dots are positioned relative to screen centre so the logo
  // never moves; the ring's largest radius (~152) stays clear of both.
  wordmark: {
    position: 'absolute',
    top: '50%',
    marginTop: 162,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dotsRow: {
    position: 'absolute',
    top: '50%',
    marginTop: 214,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
