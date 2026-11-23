import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Radius, Spacing, useColors } from '../constants/theme';
import { useRealtimeStore } from '../store/realtimeStore';

const SHOW_MS = 4500;

// A small banner at the top of the screen for a notification or message that arrives while the app is open.
// Tap it to open what it is about; it goes away by itself. (The phone's own push banner is not shown at the same time:
// see pushNotifications.ts.)
export function InAppNotificationBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const banner = useRealtimeStore((s) => s.banner);
  const dismiss = useRealtimeStore((s) => s.dismissBanner);
  const slide = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!banner) return;
    slide.setValue(-120);
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(timer);
  }, [banner?.key]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 1000, elevation: 12 },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          paddingVertical: Spacing.sm + 2,
          paddingHorizontal: Spacing.md,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        },
        title: { fontSize: 14, fontWeight: '700', color: colors.text },
        body: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
      }),
    [colors]
  );

  if (!banner) return null;

  const open = () => {
    const { route, notificationId } = banner;
    dismiss();
    if (notificationId) api.patch(`/notifications/${notificationId}/read`).catch(() => {});
    if (route) {
      try {
        router.push(route as any);
      } catch {
        // A bad destination must never crash the app.
      }
    }
  };

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + Spacing.sm, transform: [{ translateY: slide }] }]} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={open}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${banner.title}. ${banner.body}`}
        accessibilityHint="Opens it"
      >
        <Text style={styles.title} numberOfLines={1}>
          {banner.title}
        </Text>
        {banner.body ? (
          <Text style={styles.body} numberOfLines={2}>
            {banner.body}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
