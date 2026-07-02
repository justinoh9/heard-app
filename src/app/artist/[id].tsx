import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
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
 * Public artist page: an animated "record player" hero — a spinning vinyl with
 * the artist's album covers around the rim and their photo as the center label,
 * over a blurred backdrop — then a "Popular" song list (expandable) and a
 * horizontally scrolling discography. Name + image ride in via route params;
 * songs and albums are fetched here. Spotify's current API tier omits follower
 * counts, genres, and real stream counts, so those aren't shown.
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
        <View style={[styles.banner, { paddingTop: insets.top + Spacing.six }]}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundSelected }]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.bannerTint]} pointerEvents="none" />

          <RecordPlayer image={image} albums={albums} size={216} />
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

/**
 * Spinning vinyl: album covers orbit the rim, the artist photo is the center
 * label, and the whole disc rotates continuously. Covers fill in once the
 * discography loads; the disc spins regardless.
 */
function RecordPlayer({ image, albums, size }: { image?: string; albums: SearchResult[]; size: number }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 16000, easing: Easing.linear }), -1, false);
  }, [rotation]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const R = size / 2;
  const covers = albums.slice(0, 6);
  const artSize = Math.round(size * 0.17);
  const orbit = R * 0.66;
  const label = Math.round(size * 0.36);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: R,
            backgroundColor: '#0c0c0e',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          },
          spin,
        ]}>
        {[0.92, 0.78, 0.62, 0.46].map((f) => (
          <View
            key={f}
            style={{
              position: 'absolute',
              width: size * f,
              height: size * f,
              borderRadius: (size * f) / 2,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          />
        ))}
        {covers.map((al, i) => {
          const angle = (i / covers.length) * 360;
          return (
            <View
              key={al.id}
              style={{
                position: 'absolute',
                transform: [{ rotate: `${angle}deg` }, { translateY: -orbit }, { rotate: `${-angle}deg` }],
              }}>
              <AlbumCover uri={al.coverUrl} size={artSize} radius={6} />
            </View>
          );
        })}
      </Animated.View>

      <View style={[styles.recordLabel, { width: label, height: label, borderRadius: label / 2 }]}>
        <AlbumCover uri={image} size={label} radius={label / 2} fallbackIcon="person" />
      </View>
      <View style={styles.spindle} pointerEvents="none" />
    </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  banner: { alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.five, overflow: 'hidden' },
  bannerTint: { backgroundColor: 'rgba(0,0,0,0.55)' },
  bannerName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  recordLabel: { overflow: 'hidden', borderWidth: 4, borderColor: '#0c0c0e' },
  spindle: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#0c0c0e' },
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
