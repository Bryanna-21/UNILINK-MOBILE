import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const BG = '#FFFFFF';
const BLUE = '#1560C8';
const TEAL = '#0FAFB3';
const NAVY = '#152356';
const GREEN = '#16A34A';

const BASE_SCREEN_SIZE = 390;
const BASE_LOGO_SIZE = 260;

export function LoadingSplash() {
  const { width, height } = useWindowDimensions();
  const screenSize = Math.min(width, height);
  const scale = Math.min(Math.max(screenSize / BASE_SCREEN_SIZE, 0.82), 1.15);

  const logoSize = BASE_LOGO_SIZE * scale;
  const dotOffset = 142 * scale;
  const pulse = useRef(new Animated.Value(0)).current;
  const exileOpacity = useRef(new Animated.Value(0)).current;
  const exileRise = useRef(new Animated.Value(8)).current;

  const dotAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    // Gentle Facebook-style logo breathing animation.
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

    // X by EXILE appears subtly at the bottom.
    const exileIn = Animated.parallel([
      Animated.timing(exileOpacity, {
        toValue: 1,
        duration: 420,
        delay: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(exileRise, {
        toValue: 0,
        duration: 420,
        delay: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Three simple loading dots.
    const dotLoop = Animated.loop(
      Animated.stagger(
        160,
        dotAnims.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 380,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0.3,
              duration: 380,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      )
    );

    pulseLoop.start();
    exileIn.start();
    dotLoop.start();

    return () => {
      pulseLoop.stop();
      exileIn.stop();
      dotLoop.stop();
    };
  }, [pulse, exileOpacity, exileRise, dotAnims]);

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  const logoOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <View
      style={styles.root}
      accessibilityLabel="Loading UniLink"
      accessibilityRole="progressbar"
    >
      {/* Centered UniLink app logo */}
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
        resizeMode="contain"
      />

      {/* Three loading dots */}
      <View
        style={[
          styles.dotsRow,
          {
            marginTop: dotOffset,
          },
        ]}
        accessibilityElementsHidden
      >
        {dotAnims.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === 0 ? BLUE : index === 1 ? NAVY : TEAL,
                opacity: value,
                transform: [
                  {
                    scale: value.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* Exile Organization branding — fixed at the bottom */}
      <Animated.View
        style={[
          styles.exileBrand,
          {
            opacity: exileOpacity,
            transform: [{ translateY: exileRise }],
          },
        ]}
      >
        <View style={styles.exileX}>
          <View style={styles.xBarOne} />
          <View style={styles.xBarTwo} />
        </View>

        <Text style={styles.byText}>by</Text>
        <Text style={styles.exileText}>EXILE</Text>
      </Animated.View>
    </View>
  );
}

export const BootSplash = LoadingSplash;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: BASE_LOGO_SIZE,
    height: BASE_LOGO_SIZE,
  },

  dotsRow: {
    position: 'absolute',
    top: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  exileBrand: {
    position: 'absolute',
    bottom: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },

  exileX: {
    width: 20,
    height: 20,
    marginRight: 7,
    position: 'relative',
  },

  xBarOne: {
    position: 'absolute',
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    top: 8,
    left: -2,
    transform: [{ rotate: '45deg' }],
  },

  xBarTwo: {
    position: 'absolute',
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN,
    top: 8,
    left: -2,
    transform: [{ rotate: '-45deg' }],
  },

  byText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },

  exileText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: NAVY,
  },
});
