import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme, View } from 'react-native';

import { TopNavBar } from '@/components/top-nav-bar';
import { Colors } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { isWide } = useResponsive();

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {isWide && <TopNavBar />}
      <Tabs
        // undefined (not a no-op function) when narrow so mobile/native fall
        // through to React Navigation's own default tab bar, unchanged.
        tabBar={isWide ? () => null : undefined}
        screenOptions={{
          // The top nav bar already shows the brand + per-tab title; the
          // bottom tabs' own per-screen header would be redundant above it.
          headerShown: !isWide,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.backgroundElement,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Heard',
            tabBarLabel: 'Feed',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rate"
          options={{
            title: 'Rate an album',
            tabBarLabel: 'Rate',
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Leaderboard',
            tabBarLabel: 'Ranks',
            tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
