import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/auth/store';
import { ConcertsContext, useConcertsState } from '@/concerts/store';
import { RatingsContext, useRatingsState } from '@/data/store';
import { FeedContext, useFeedState } from '@/feed/store';
import { useTheme, ThemePreferenceContext, useThemePreferenceState } from '@/hooks/use-theme';
import { PlaylistsContext, usePlaylistsState } from '@/playlists/store';
import { SocialContext, useSocialState } from '@/social/store';
import { StreaksContext, useStreaksState } from '@/streaks/store';

export default function RootLayout() {
  // The display serif (wordmark + titles). Render waits for it so headings
  // never flash the system font first.
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });
  if (!fontsLoaded) return null;

  return (
    <AppThemeBridge>
      <AuthProvider>
        <StreaksBridge>
          {/* Social sits above ratings + feed: both publish activity events. */}
          <SocialBridge>
            <RatingsBridge>
              <FeedBridge>
                <ConcertsBridge>
                  <PlaylistsBridge>
                    <NavThemeProvider>
                      <RootNavigator />
                    </NavThemeProvider>
                  </PlaylistsBridge>
                </ConcertsBridge>
              </FeedBridge>
            </RatingsBridge>
          </SocialBridge>
        </StreaksBridge>
      </AuthProvider>
    </AppThemeBridge>
  );
}

/** Outermost: the selected palette (vinyl/cream) for every useTheme() below. */
function AppThemeBridge({ children }: { children: React.ReactNode }) {
  const themePreference = useThemePreferenceState();
  return (
    <ThemePreferenceContext.Provider value={themePreference}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

/** React Navigation chrome (headers, transitions) follows the app palette. */
function NavThemeProvider({ children }: { children: React.ReactNode }) {
  const palette = useTheme();
  const base = palette.isDark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: palette.accent,
          background: palette.background,
          card: palette.background,
          text: palette.text,
          border: palette.backgroundElement,
          notification: palette.accent,
        },
      }}>
      {children}
    </ThemeProvider>
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

function ConcertsBridge({ children }: { children: React.ReactNode }) {
  const concerts = useConcertsState();
  return <ConcertsContext.Provider value={concerts}>{children}</ConcertsContext.Provider>;
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
      <Stack.Screen name="concert/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="playlist/[id]" />
      <Stack.Screen name="playlist/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="streak" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="activity" />
    </Stack>
  );
}
