import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/auth/store';
import { RatingsContext, useRatingsState } from '@/data/store';

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'light';

  return (
    <AuthProvider>
      <RatingsBridge>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </RatingsBridge>
    </AuthProvider>
  );
}

function RatingsBridge({ children }: { children: React.ReactNode }) {
  const ratings = useRatingsState();
  return <RatingsContext.Provider value={ratings}>{children}</RatingsContext.Provider>;
}

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'authed' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="log" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
