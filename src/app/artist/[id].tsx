import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { musicCatalog, MusicCatalogError, type SearchResult } from '@/music';

type Theme = ReturnType<typeof useTheme>;

const POPULAR_PREVIEW = 5;

/**
 * Public artist page (Spotify-style): a full-bleed banner with the name overlaid,
 * a "Popular" song list (expandable to all we can fetch), then a horizontally
 * scrolling discography of albums + singles. Name + image ride in via route
 * params; songs and albums are fetched here. Spotify's current API tier omits
 * follower counts, genres, and real stream counts, so those aren't shown.
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
  const [songs, setSongs] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSongs, setShowAllSongs] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      musicCatalog.getArtistAlbums(id, { signal: controller.signal }),
      musicCatalog.getArtistTopTracks(name, { signal: controller.signal }).catch(() => [] as SearchResult[]),
    ])
      .then(([alb, trk]) => {
        setAlbums(alb);
        setSongs(trk);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setError(e instanceof MusicCatalogError ? e.message : 'Could not load this artist. Try again.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [id, name]);

  function openAlbum(album: SearchResult) {
    router.push({
      pathname: '/item/[id]',
      params: { id: album.id, type: 'album', title: album.title, artist: album.artist, artUrl: album.coverUrl ?? '' },
    });
  }

  function openSong(song: SearchResult) {
    router.push({
      pathname: '/log',
      params: { id: song.id, type: 'song', title: song.title, artist: song.artist, year: song.year ?? '', artUrl: song.coverUrl ?? '' },
    });
  }

  const visibleSongs = showAllSongs ? songs : songs.slice(0, POPULAR_PREVIEW);

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
          {/* Faux gradient: many faint layers compound toward the bottom for a
              smooth, line-free scrim (no gradient lib installed). */}
          {Array.from({ length: SCRIM_STEPS }).map((_, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: ((i + 1) / SCRIM_STEPS) * 240,
                backgroundColor: 'rgba(0,0,0,0.045)',
              }}
            />
          ))}
          <Text style={styles.bannerName} numberOfLines={2}>
            {name}
          </Text>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        )}

        {error && (
          <ThemedText type="small" style={[styles.error, styles.pad]}>
            {error}
          </ThemedText>
        )}

        {!loading && !error && songs.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.pad}>
              Popular
            </ThemedText>
            {visibleSongs.map((song, i) => (
              <SongRow
                key={song.id}
                index={i + 1}
                song={song}
                score={ratingFor(song.id)?.score}
                onPress={() => openSong(song)}
                theme={theme}
              />
            ))}
            {songs.length > POPULAR_PREVIEW && (
              <Pressable
                testID="toggle-songs"
                onPress={() => setShowAllSongs((v) => !v)}
                style={({ pressed }) => [styles.showAll, { opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {showAllSongs ? 'Show less' : 'Show all songs'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {!loading && !error && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.pad}>
              Discography
            </ThemedText>
            {albums.length === 0 ? (
              <EmptyState icon="disc-outline" message="No albums found for this artist." />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelf}>
                {albums.map((album) => {
                  const existing = ratingFor(album.id);
                  return (
                    <Pressable
                      key={album.id}
                      testID="artist-album"
                      onPress={() => openAlbum(album)}
                      style={({ pressed }) => [styles.albumCard, { opacity: pressed ? 0.6 : 1 }]}>
                      <View>
                        <AlbumCover uri={album.coverUrl} size={132} radius={10} />
                        {existing && (
                          <View style={styles.scorePill}>
                            <ThemedText type="small" style={{ color: '#fff', fontWeight: '700' }}>
                              {existing.score.toFixed(1)}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText type="small" numberOfLines={1} style={styles.albumTitle}>
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
              </ScrollView>
            )}
          </View>
        )}
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

function SongRow({
  index,
  song,
  score,
  onPress,
  theme,
}: {
  index: number;
  song: SearchResult;
  score?: number;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      testID="popular-song"
      onPress={onPress}
      style={({ pressed }) => [styles.songRow, styles.pad, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.songNum}>
        {index}
      </ThemedText>
      <AlbumCover uri={song.coverUrl} size={44} />
      <View style={styles.songText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {song.title}
        </ThemedText>
        {!!song.albumTitle && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {song.albumTitle}
          </ThemedText>
        )}
      </View>
      {score != null ? (
        <View style={styles.scorePillInline}>
          <ThemedText type="small" style={{ color: '#fff', fontWeight: '700' }}>
            {score.toFixed(1)}
          </ThemedText>
        </View>
      ) : (
        <Ionicons name="add-circle-outline" size={22} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const SCRIM_STEPS = 12;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  banner: { width: '100%', height: 300, justifyContent: 'flex-end' },
  bannerFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerName: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    textShadowColor: 'rgba(0,0,0,0.45)',
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
  loading: { paddingVertical: Spacing.six, alignItems: 'center' },
  error: { color: '#E24B4A', marginTop: Spacing.three },
  pad: { paddingHorizontal: Spacing.four },
  section: { marginTop: Spacing.four, gap: Spacing.two },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  songNum: { minWidth: 18, textAlign: 'center' },
  songText: { flex: 1, gap: 1 },
  showAll: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  shelf: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  albumCard: { width: 132, gap: 3 },
  albumTitle: { marginTop: 4 },
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
  scorePillInline: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 34,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    alignItems: 'center',
  },
});
