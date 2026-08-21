import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useThemeStore } from '../src/store/themeStore';
import { useColors } from '../src/constants/theme';

export default function RootLayout() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const isThemeHydrated = useThemeStore((s) => s.isHydrated);
  const themeMode = useThemeStore((s) => s.mode);
  const colors = useColors();

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, []);

  // Wait on both auth AND theme hydration before rendering real UI —
  // otherwise the first frame could flash light-mode colors for
  // someone who has dark mode saved, then jump to dark a moment later.
  const isHydrated = isAuthHydrated && isThemeHydrated;

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
