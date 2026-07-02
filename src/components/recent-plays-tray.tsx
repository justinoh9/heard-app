import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userLibrary, MusicCatalogError, type SearchResult } from '@/music';

/**
 * "Recently played" import tray (PRODUCT_BLUEPRINT §2.A): a horizontal strip of
 * the user's latest Spotify plays, each one tap away from the log flow. This is
 * an *active-log* on-ramp — plays shown here are candidates, never automatic
 * diary entries. Shows a Connect Spotify card until the user links their
 * account; renders nothing when no client ID is configured.
 */
export function RecentPlaysTray({ onPick }: { onPick: (item: SearchResult) => void }) {
  const theme = useTheme();
  const [status, setStatus] = useState<'checking' | 'disconnected' | 'loading' | 'ready'>(
    'checking',
  );
  const [plays, setPlays] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setPlays(await userLibrary.getRecentlyPlayed());
      setStatus('ready');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof MusicCatalogError ? e.message : 'Could not load your listening.');
      // An expired token disconnects itself (see user-library) — re-offer connect.
      setStatus((await userLibrary.isConnected()) ? 'ready' : 'disconnected');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    userLibrary.isConnected().then((connected) => {
      if (!alive) return;
      if (connected) load();
      else setStatus('disconnected');
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      if (await userLibrary.connect()) await load();
    } catch (e) {
      setError(e instanceof MusicCatalogError ? e.message : 'Spotify login failed.');
    } finally {
      setConnecting(false);
    }
  }

  // No client ID in this build — the tray simply doesn't exist.
  if (!userLibrary.isConfigured() || status === 'checking') return null;

  if (status === 'disconnected') {
    return (
      <View style={[styles.connectCard, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="musical-notes" size={22} color="#1D9E75" />
        <View style={styles.connectText}>
          <ThemedText type="smallBold">See what you've been playing</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Connect Spotify to log recent listens in one tap.
          </ThemedText>
        </View>
        <Pressable
          onPress={connect}
          disabled={connecting}
          accessibilityLabel="Connect Spotify"
          style={({ pressed }) => [
            styles.connectButton,
            { opacity: pressed || connecting ? 0.7 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {connecting ? 'Connecting…' : 'Connect'}
          </ThemedText>
        </Pressable>
        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <View style={styles.tray}>
      <View style={styles.headerRow}>
        <ThemedText type="subtitle">Recently played</ThemedText>
        <Pressable onPress={load} accessibilityLabel="Refresh recently played" hitSlop={8}>
          <Ionicons name="refresh" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}>
        {status === 'loading'
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} style={styles.skeletonCard} />)
          : plays.map((p) => (
              <Pressable
                key={p.id}
                testID="recent-play"
                onPress={() => onPick(p)}
                accessibilityLabel={`Log ${p.title}`}
                style={({ pressed }) => [styles.card, { opacity: pressed ? 0.6 : 1 }]}>
                <AlbumCover uri={p.coverUrl} size={96} />
                <ThemedText type="small" numberOfLines={1} style={styles.cardTitle}>
                  {p.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {p.artist}
                </ThemedText>
              </Pressable>
            ))}
        {status === 'ready' && plays.length === 0 && !error && (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing played recently — go listen to something!
          </ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { gap: Spacing.two },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strip: { gap: Spacing.three, paddingVertical: Spacing.one },
  card: { width: 96 },
  cardTitle: { marginTop: Spacing.one, fontWeight: '600' },
  skeletonCard: { width: 96, height: 96, borderRadius: 8 },
  connectCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  connectText: { flex: 1, gap: 2, minWidth: 160 },
  connectButton: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  error: { color: '#E24B4A', width: '100%' },
});
