import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Radius, useColors } from '../constants/theme';

type LoadingSkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function LoadingSkeleton({
  width = '100%',
  height = 18,
  radius,
  style,
}: LoadingSkeletonProps) {
  const colors = useColors();
  const translateX = useRef(new Animated.Value(-180)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      translateX.stopAnimation();
      translateX.setValue(-180);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 420,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.delay(160),
        Animated.timing(translateX, {
          toValue: -180,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [reduceMotion, translateX]);

  return (
    <Animated.View
      accessible={false}
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius ?? Radius.sm,
          backgroundColor: colors.skeletonBase,
        },
        style,
      ]}
    >
      {!reduceMotion && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wipe,
            {
              backgroundColor: colors.skeletonHighlight,
              transform: [{ translateX }, { skewX: '-12deg' }],
            },
          ]}
        />
      )}
    </Animated.View>
  );
}


export function LoadingSkeletonList({
  rows = 3,
  variant = 'card',
}: {
  rows?: number;
  variant?: 'card' | 'text';
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.listCard,
            variant === 'text' && styles.textCard,
          ]}
        >
          <LoadingSkeleton
            width={variant === 'text' ? '34%' : 46}
            height={variant === 'text' ? 13 : 46}
            radius={variant === 'text' ? Radius.sm : 23}
          />

          <View style={styles.listBody}>
            <LoadingSkeleton width="62%" height={14} />
            <LoadingSkeleton
              width="92%"
              height={11}
              style={styles.listLine}
            />
            <LoadingSkeleton
              width="74%"
              height={11}
              style={styles.listLineShort}
            />
          </View>
        </Animated.View>
      ))}
    </>
  );
}


export function LoadingSkeletonGrid({
  rows = 2,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows * columns }).map((_, index) => (
        <LoadingSkeleton
          key={index}
          width="100%"
          height={112}
          radius={Radius.md}
          style={styles.gridTile}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    position: 'relative',
  },

  wipe: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    width: 100,
    opacity: 0.72,
  },

  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: Radius.lg,
  },

  textCard: {
    paddingHorizontal: 0,
  },

  listBody: {
    flex: 1,
    marginLeft: 12,
  },

  listLine: {
    marginTop: 9,
  },

  listLineShort: {
    marginTop: 7,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  gridTile: {
    width: '31.8%',
    marginHorizontal: '0.75%',
    marginBottom: 8,
  },








});
