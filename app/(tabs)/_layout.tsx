import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useColors } from '../../src/constants/theme';
import type { ColorValue } from 'react-native';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return (
    <View>
      <Text style={{ fontSize: 20, color }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();

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
      {/* =====================================================
          PRIMARY STUDENT NAVIGATION
          These are the ONLY screens shown in the bottom bar.
          ===================================================== */}

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

      {/* =====================================================
          SECONDARY ROUTES
          These screens remain real routes but NEVER appear
          in the bottom navigation.
          ===================================================== */}

      <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
      <Tabs.Screen name="lecturer-dashboard" options={{ href: null }} />
      <Tabs.Screen name="emergency" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="courses" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
