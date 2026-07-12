import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { AnimatedWordmark } from '@/components/animated-wordmark';
import { TopNavBar } from '@/components/top-nav-bar';
import { useResponsive } from '@/hooks/use-responsive';
import { useDisplayFont, useTheme } from '@/hooks/use-theme';
import { useOnboardingRedirect } from '@/onboarding/use-onboarding-redirect';

export default function TabsLayout() {
  const colors = useTheme();
  const displayFont = useDisplayFont();
  const { isWide } = useResponsive();
  // Send brand-new users through the onboarding wizard once (no-op otherwise).
  useOnboardingRedirect();

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
          headerTitleStyle: { color: colors.text, fontFamily: displayFont, fontSize: 20 },
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: { fontFamily: displayFont, fontSize: 12 },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.backgroundElement,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'jelli',
            headerTitle: () => (
              <AnimatedWordmark text="jelli" style={{ fontFamily: displayFont, fontSize: 20, color: colors.text }} />
            ),
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
