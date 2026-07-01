import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { musicCatalog, MusicCatalogError, type SearchResult } from '@/music';

/**
 * Public artist page (Spotify-style): circular hero, name, then the artist's
 * discography. Name + image ride in via route params (instant render); the
 * albums are fetched here. Note: Spotify's current API tier returns only
 * id/name/images for artists — no follower count, genres, or popularity — so
 * the header is deliberately image + name, and the discography carries the page.
 */
export default function ArtistProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ratingFor } = useRatings();
  const params = useLocalSearchParams<{ id: string; name?: string; image?: string }>();

  const id = String(params.id);
  const name = params.name ? String(params.name) : 'Artist';
  const image = params.image || undefined;

  const [albums, setAlbums] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    musicCatalog
      .getArtistAlbums(id, { signal: controller.signal })
      .then((r) => {
        setAlbums(r);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setError(e instanceof MusicCatalogError ? e.message : 'Could not load albums. Try again.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  function openAlbum(album: SearchResult) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: album.id,
        type: 'album',
        title: album.title,
        artist: album.artist,
        artUrl: album.coverUrl ?? '',
      },
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Artist</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.header}>
            <AlbumCover uri={image} size={150} radius={75} fallbackIcon="person" />
            <ThemedText type="title" style={styles.center} numberOfLines={2}>
              {name}
            </ThemedText>
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            DISCOGRAPHY
          </ThemedText>

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator />
            </View>
          )}

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {!loading && !error && albums.length === 0 && (
            <EmptyState icon="disc-outline" message="No albums found for this artist." />
          )}

          {!loading && !error && albums.length > 0 && (
            <View style={styles.grid}>
              {albums.map((album) => {
                const existing = ratingFor(album.id);
                return (
                  <Pressable
                    key={album.id}
                    testID="artist-album"
                    onPress={() => openAlbum(album)}
                    style={({ pressed }) => [styles.card, { opacity: pressed ? 0.6 : 1 }]}>
                    <View>
                      <AlbumCover uri={album.coverUrl} fill radius={10} />
                      {existing && (
                        <View style={styles.scorePill}>
                          <ThemedText type="small" style={{ color: '#fff', fontWeight: '700' }}>
                            {existing.score.toFixed(1)}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.cardTitle}>
                      {album.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {[album.year, album.primaryType !== 'Album' ? album.primaryType : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  header: { alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  sectionLabel: { marginTop: Spacing.two },
  loading: { paddingVertical: Spacing.six, alignItems: 'center' },
  error: { color: '#E24B4A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.three },
  card: { width: '47%', gap: 4, marginBottom: Spacing.two },
  cardTitle: { marginTop: 4 },
  scorePill: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 34,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    alignItems: 'center',
  },
});
