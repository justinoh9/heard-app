import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * Public artist page (Spotify-style): a full-bleed banner with the artist name
 * overlaid, then the discography. Name + image ride in via route params (instant
 * render); the albums are fetched here. Spotify's current API tier returns only
 * id/name/images for artists — no follower count, genres, or top-tracks — so the
 * page centers on the banner and the discography.
 */
export default function ArtistProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.bannerFallback]}>
              <Ionicons name="person" size={80} color={theme.textSecondary} />
            </View>
          )}
          <View style={styles.scrimTop} />
          <View style={styles.scrimBottom} />
          <Text style={styles.bannerName} numberOfLines={2}>
            {name}
          </Text>
        </View>

        <PageContainer style={styles.body}>
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

      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Back"
        hitSlop={8}
        style={[styles.backBtn, { top: insets.top + Spacing.two }]}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  banner: { width: '100%', height: 320, justifyContent: 'flex-end' },
  bannerFallback: { alignItems: 'center', justifyContent: 'center' },
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 96, backgroundColor: 'rgba(0,0,0,0.28)' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.42)' },
  bannerName: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.three,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: Spacing.three, paddingTop: Spacing.three },
  sectionLabel: { marginTop: Spacing.one },
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
