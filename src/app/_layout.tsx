import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/auth/store';
import { RatingsContext, useRatingsState } from '@/data/store';
import { FeedContext, useFeedState } from '@/feed/store';
import { PlaylistsContext, usePlaylistsState } from '@/playlists/store';
import { SocialContext, useSocialState } from '@/social/store';
import { StreaksContext, useStreaksState } from '@/streaks/store';

export default function RootLayout() {
  const scheme = useColorScheme() ?? 'light';

  return (
    <AuthProvider>
      <StreaksBridge>
        {/* Social sits above ratings + feed: both publish activity events. */}
        <SocialBridge>
          <RatingsBridge>
            <FeedBridge>
              <PlaylistsBridge>
                <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <RootNavigator />
                </ThemeProvider>
              </PlaylistsBridge>
            </FeedBridge>
          </RatingsBridge>
        </SocialBridge>
      </StreaksBridge>
    </AuthProvider>
  );
}

function StreaksBridge({ children }: { children: React.ReactNode }) {
  const streaks = useStreaksState();
  return <StreaksContext.Provider value={streaks}>{children}</StreaksContext.Provider>;
}

function SocialBridge({ children }: { children: React.ReactNode }) {
  const social = useSocialState();
  return <SocialContext.Provider value={social}>{children}</SocialContext.Provider>;
}

function RatingsBridge({ children }: { children: React.ReactNode }) {
  const ratings = useRatingsState();
  return <RatingsContext.Provider value={ratings}>{children}</RatingsContext.Provider>;
}

function FeedBridge({ children }: { children: React.ReactNode }) {
  const feed = useFeedState();
  return <FeedContext.Provider value={feed}>{children}</FeedContext.Provider>;
}

function PlaylistsBridge({ children }: { children: React.ReactNode }) {
  const playlists = usePlaylistsState();
  return <PlaylistsContext.Provider value={playlists}>{children}</PlaylistsContext.Provider>;
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
      <Stack.Screen name="drop" options={{ presentation: 'modal' }} />
      <Stack.Screen name="playlist/[id]" />
      <Stack.Screen name="playlist/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="streak" />
    </Stack>
  );
}
