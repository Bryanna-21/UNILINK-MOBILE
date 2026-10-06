import React from 'react';
import { StyleSheet, View } from 'react-native';

type UniLinkAIIconProps = {
  size?: number;
  color?: string;
  secondaryColor?: string;
};

export default function UniLinkAIIcon({
  size = 32,
  color = '#16A34A',
  secondaryColor = '#2563EB',
}: UniLinkAIIconProps) {
  const ringSize = size * 0.58;
  const borderWidth = Math.max(2, Math.round(size * 0.09));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="UniLink AI"
    >
      <View
        style={[
          styles.link,
          {
            width: ringSize,
            height: ringSize * 0.62,
            borderWidth,
            borderColor: color,
            borderRadius: ringSize,
            transform: [{ rotate: '-42deg' }],
            left: size * 0.05,
            top: size * 0.16,
          },
        ]}
      />
      <View
        style={[
          styles.link,
          {
            width: ringSize,
            height: ringSize * 0.62,
            borderWidth,
            borderColor: secondaryColor,
            borderRadius: ringSize,
            transform: [{ rotate: '-42deg' }],
            right: size * 0.05,
            bottom: size * 0.16,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    position: 'absolute',
  },
});
