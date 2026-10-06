import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useColors } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/authStore';

// Simple text-glyph icons for now — no icon library added yet since
// none was needed until this exact point. Swappable later for a real
// icon set (e.g. @expo/vector-icons, already bundled with Expo) without
// changing any navigation logic.
import type { ColorValue } from 'react-native';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return (
    <View>
      <Text style={{ fontSize: 20, color }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  // Was a static Colors import — meant the tab bar stayed pure white
  // at the bottom of every screen even in dark mode, visible on all
  // five tabs, all the time. Same bug class as emergency.tsx and
  // chat[id].tsx: hardcoded palette that never re-renders on toggle.
  const colors = useColors();

  // Safe to read synchronously here with no loading/race state to
  // handle: the root layout (app/_layout.tsx) already blocks all
  // rendering, this file included, until auth hydration finishes.
  // By the time TabsLayout ever mounts, user is either a fully
  // resolved real user or genuinely null (logged out, which
  // shouldn't reach (tabs) at all per the root Stack, but the
  // fallback below still defaults to the student set rather than
  // crashing if that assumption is ever wrong).
  const role = useAuthStore((s) => s.user?.role) ?? 'student';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      {/*
        Student-only tabs. This is the original, fully real tab set —
        unchanged in content, just now explicitly scoped to students
        rather than shown to everyone regardless of role.
      */}
      <Tabs.Protected guard={role === 'student'}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabIcon glyph="⌂" color={color} />,
          }}
        />
        <Tabs.Screen
          name="academics"
          options={{
            title: 'Academics',
            tabBarIcon: ({ color }) => <TabIcon glyph="📚" color={color} />,
          }}
        />
        <Tabs.Screen
          name="campus"
          options={{
            title: 'Campus',
            tabBarIcon: ({ color }) => <TabIcon glyph="👥" color={color} />,
          }}
        />
      </Tabs.Protected>

      {/*
        Lecturer-only tab. Shell screen today (see
        lecturer-dashboard.tsx's own STATUS comment) — this is the
        first exercise of the pattern, not a finished feature.
      */}
      <Tabs.Protected guard={role === 'lecturer'}>
        <Tabs.Screen
          name="lecturer-dashboard"
          options={{
            title: 'Lecturer',
            tabBarIcon: ({ color }) => <TabIcon glyph="🎓" color={color} />,
          }}
        />
      </Tabs.Protected>

      {/*
        Admin-only tab. Same shell status as lecturer-dashboard above.
      */}
      <Tabs.Protected guard={role === 'admin'}>
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color }) => <TabIcon glyph="🛡️" color={color} />,
          }}
        />
      </Tabs.Protected>

      {/*
        Shared across every role. messages.tsx already resolves each
        participant's own role independently (see its
        participantRoles state) — a lecturer messaging a student uses
        the exact same screen, so this is not gated at all.
      */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <TabIcon glyph="💬" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color }) => <TabIcon glyph="👤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
