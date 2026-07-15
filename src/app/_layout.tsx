import { Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { PreviewContext, STATIC_PREVIEW, usePreviewState } from '@/audio/preview';
import { JelliLoader } from '@/components/jelli-loader';
import { ThemedView } from '@/components/themed-view';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/auth/store';
import {
  parseOAuthError,
  peekPendingOAuthError,
  setPendingOAuthError,
} from '@/auth/oauth-error';
import { ConcertsContext, useConcertsState } from '@/concerts/store';
import { RatingsContext, useRatingsState } from '@/data/store';
import { FeedContext, useFeedState } from '@/feed/store';
import { useTheme, ThemePreferenceContext, useThemePreferenceState } from '@/hooks/use-theme';
import { NotificationsContext, useNotificationsState } from '@/notifications/store';
import { PlaylistsContext, usePlaylistsState } from '@/playlists/store';
import { QueueContext, useQueueState } from '@/queue/store';
import { ModerationContext, useModerationState } from '@/moderation/store';
import { SocialContext, useSocialState } from '@/social/store';
import { StreaksContext, useStreaksState } from '@/streaks/store';

export default function RootLayout() {
  // The per-mode display faces (wordmark + titles). Render waits for them so
  // headings never flash the system font first. Keep in sync with DisplayFonts.
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Baloo2_600SemiBold,
    PatrickHand_400Regular,
  });

  // Capture an OAuth-redirect error (e.g. Spotify login failing server-side)
  // off the URL during render — before the Supabase client, created in a child
  // effect, can strip it — and stash it for the sign-in screen to display.
  const capturedOAuthError = useRef(false);
  if (!capturedOAuthError.current && Platform.OS === 'web' && typeof window !== 'undefined') {
    capturedOAuthError.current = true;
    const err = parseOAuthError(window.location.href);
    if (err) setPendingOAuthError(err);
  }

  // Native blocks render on the display fonts so headings never flash the
  // system face. Web must NOT block: during `expo export` static rendering the
  // fonts never resolve, and returning null here exports an EMPTY <body> for
  // every route — killing the crawlable pages (about/privacy) the AdSense
  // review depends on. In the browser the font-family is already set, so the
  // text simply repaints when the FontFace finishes loading (brief swap).
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <AppThemeBridge>
      <PreviewBridge>
        <AuthProvider>
        <StreaksBridge>
          {/* Above social: the social store filters its feed + directory
              through the viewer's block list. */}
          <ModerationBridge>
          {/* Social sits above ratings + feed: both publish activity events. */}
          <SocialBridge>
            <RatingsBridge>
              <FeedBridge>
                <ConcertsBridge>
                  <PlaylistsBridge>
                    <QueueBridge>
                      {/* Below ratings: notifications scope to the viewer's rated items. */}
                      <NotificationsBridge>
                        <NavThemeProvider>
                          <ToastProvider>
                            <RootNavigator />
                          </ToastProvider>
                        </NavThemeProvider>
                      </NotificationsBridge>
                    </QueueBridge>
                  </PlaylistsBridge>
                </ConcertsBridge>
              </FeedBridge>
            </RatingsBridge>
          </SocialBridge>
          </ModerationBridge>
        </StreaksBridge>
        </AuthProvider>
      </PreviewBridge>
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

function PreviewBridge({ children }: { children: React.ReactNode }) {
  // Static rendering can't construct the audio player (no `Audio` in Node) —
  // hand the export the inert context instead of throwing. The branch is
  // fixed per environment, so the hook call below is unconditional in any
  // render that reaches it.
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return <PreviewContext.Provider value={STATIC_PREVIEW}>{children}</PreviewContext.Provider>;
  }
  return <LivePreviewBridge>{children}</LivePreviewBridge>;
}

function LivePreviewBridge({ children }: { children: React.ReactNode }) {
  const preview = usePreviewState();
  return <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>;
}

function StreaksBridge({ children }: { children: React.ReactNode }) {
  const streaks = useStreaksState();
  return <StreaksContext.Provider value={streaks}>{children}</StreaksContext.Provider>;
}

function ModerationBridge({ children }: { children: React.ReactNode }) {
  const moderation = useModerationState();
  return <ModerationContext.Provider value={moderation}>{children}</ModerationContext.Provider>;
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

function QueueBridge({ children }: { children: React.ReactNode }) {
  const queue = useQueueState();
  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

function NotificationsBridge({ children }: { children: React.ReactNode }) {
  const notifications = useNotificationsState();
  return <NotificationsContext.Provider value={notifications}>{children}</NotificationsContext.Provider>;
}

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // A failed OAuth redirect (captured in RootLayout) lands the user back on the
  // origin, not the auth screen. Send them to sign-in where the message shows;
  // the replace also drops the `?error=` query from the URL.
  //
  // Gated on status !== 'loading' (like the redirect below): replacing the route
  // during the initial loading mount, before the navigation tree settles,
  // remounts the whole provider stack in a loop. The ref makes it fire once —
  // useRouter() changes identity on navigation, which would otherwise re-run it.
  const handledOAuthError = useRef(false);
  useEffect(() => {
    if (handledOAuthError.current || status === 'loading') return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!peekPendingOAuthError()) return;
    handledOAuthError.current = true;
    router.replace('/(auth)/sign-in');
  }, [status, router]);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    // The app is browsable signed-out; guests only get redirected out of the
    // auth screens once they're authed. Account-only actions gate themselves
    // via useRequireAuth, so there's no blanket wall for signed-out users.
    if (status === 'authed' && inAuthGroup) {
      // Return to wherever sign-in was triggered from (the item they were
      // rating, the profile tab, …) instead of always dumping them on Home.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [status, segments, router]);

  // During static export (Node — no window) effects never run, so auth stays
  // 'loading' forever; showing the loader there would bake a spinner into
  // every exported page instead of its content. Render the tree: the screens'
  // signed-out/empty states ARE the correct crawlable output. In the browser
  // the loader still gates as before.
  const isStaticRender = Platform.OS === 'web' && typeof window === 'undefined';
  if (status === 'loading' && !isStaticRender) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <JelliLoader scale={1.4} />
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="log" options={{ presentation: 'modal' }} />
      <Stack.Screen name="drop" options={{ presentation: 'modal' }} />
      <Stack.Screen name="repost" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="share-card" options={{ presentation: 'modal' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal' }} />
      <Stack.Screen name="concert/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="playlist/[id]" />
      <Stack.Screen name="playlist/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="streak" />
      <Stack.Screen name="badges" />
      <Stack.Screen name="blocked" />
      <Stack.Screen name="concerts" />
      <Stack.Screen name="diary" />
      <Stack.Screen name="queue" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
