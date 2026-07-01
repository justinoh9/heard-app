import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { useMusicSearch, type SearchResult } from '@/music';

/**
 * Search + rate surface, laid out like Spotify's search: a "Top result" card,
 * then Songs, Artists, and Albums sections. Tapping an artist opens their page;
 * tapping an album or song opens the rate flow.
 */
export default function RateSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ratingFor } = useRatings();
  const [query, setQuery] = useState('');
  const { results, loading, error } = useMusicSearch(query, 'all');

  const artists = results.filter((r) => r.kind === 'artist');
  const albums = results.filter((r) => r.kind === 'album');
  const songs = results.filter((r) => r.kind === 'song');
  // The single best match Spotify surfaces first — prefer an exact-ish artist.
  const topResult = artists[0] ?? albums[0] ?? songs[0];
  const notTop = (r: SearchResult) => r.id !== topResult?.id;

  function openRate(item: SearchResult) {
    router.push({
      pathname: '/log',
      params: {
        id: item.id,
        type: item.kind,
        title: item.title,
        artist: item.artist,
        year: item.year ?? '',
        artUrl: item.coverUrl ?? '',
      },
    });
  }

  function openArtist(artist: SearchResult) {
    // Only name + image are known from search; the artist page fetches the rest.
    router.push({
      pathname: '/artist/[id]',
      params: { id: artist.id, name: artist.title, image: artist.coverUrl ?? '' },
    });
  }

  function open(item: SearchResult) {
    if (item.kind === 'artist') openArtist(item);
    else openRate(item);
  }

  const trimmed = query.trim();

  return (
    <ThemedView style={styles.screen}>
      <PageContainer>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Artists, songs, or albums"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </PageContainer>

      {!trimmed ? (
        <EmptyState icon="search" message="Search an artist, song, or album." />
      ) : loading && results.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : results.length === 0 ? (
        <EmptyState icon="sad-outline" message={`No results for “${trimmed}”`} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}>
          {topResult && (
            <>
              <SectionHeader label="Top result" />
              <TopResultCard
                result={topResult}
                score={ratingFor(topResult.id)?.score}
                onPress={() => open(topResult)}
                theme={theme}
              />
            </>
          )}

          {songs.length > 0 && (
            <>
              <SectionHeader label="Songs" />
              {songs.slice(0, 4).map((s) => (
                <ResultRow
                  key={s.id}
                  item={s}
                  score={ratingFor(s.id)?.score}
                  onPress={() => openRate(s)}
                  theme={theme}
                />
              ))}
            </>
          )}

          {artists.filter(notTop).length > 0 && (
            <>
              <SectionHeader label="Artists" />
              {artists.filter(notTop).map((a) => (
                <ArtistRow key={a.id} artist={a} onPress={() => openArtist(a)} theme={theme} />
              ))}
            </>
          )}

          {albums.filter(notTop).length > 0 && (
            <>
              <SectionHeader label="Albums" />
              {albums.filter(notTop).map((al) => (
                <ResultRow
                  key={al.id}
                  item={al}
                  score={ratingFor(al.id)?.score}
                  onPress={() => openRate(al)}
                  theme={theme}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

type Theme = ReturnType<typeof useTheme>;

function SectionHeader({ label }: { label: string }) {
  return (
    <ThemedText type="subtitle" style={styles.sectionHeader}>
      {label}
    </ThemedText>
  );
}

function subtitleFor(item: SearchResult): string {
  if (item.kind === 'song') {
    return item.albumTitle ? `${item.artist} · ${item.albumTitle}` : item.artist;
  }
  return item.year ? `${item.artist} · ${item.year}` : item.artist;
}

function ScorePill({ score }: { score: number }) {
  return (
    <View style={styles.scorePill}>
      <ThemedText type="smallBold" style={{ color: '#fff' }}>
        {score.toFixed(1)}
      </ThemedText>
    </View>
  );
}

function TopResultCard({
  result,
  score,
  onPress,
  theme,
}: {
  result: SearchResult;
  score?: number;
  onPress: () => void;
  theme: Theme;
}) {
  const isArtist = result.kind === 'artist';
  const label = isArtist ? 'Artist' : result.kind === 'song' ? 'Song' : 'Album';
  return (
    <Pressable
      testID="top-result"
      onPress={onPress}
      style={({ pressed }) => [
        styles.topCard,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <AlbumCover
        uri={result.coverUrl}
        size={84}
        radius={isArtist ? 42 : 8}
        fallbackIcon={isArtist ? 'person' : 'disc-outline'}
      />
      <ThemedText type="title" numberOfLines={2} style={styles.topTitle}>
        {result.title}
      </ThemedText>
      <View style={styles.topMetaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {isArtist ? label : `${label} · ${result.artist}`}
        </ThemedText>
        {score != null && <ScorePill score={score} />}
      </View>
    </Pressable>
  );
}

function ResultRow({
  item,
  score,
  onPress,
  theme,
}: {
  item: SearchResult;
  score?: number;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      testID={item.kind === 'song' ? 'song-result' : 'album-result'}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <AlbumCover uri={item.coverUrl} size={52} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitleFor(item)}
        </ThemedText>
      </View>
      {score != null ? (
        <ScorePill score={score} />
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

function ArtistRow({
  artist,
  onPress,
  theme,
}: {
  artist: SearchResult;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      testID="artist-result"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <AlbumCover uri={artist.coverUrl} size={52} radius={26} fallbackIcon="person" />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {artist.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          Artist
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    margin: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#E24B4A', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  center: { flex: 1, alignItems: 'center', paddingTop: Spacing.six },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  sectionHeader: { marginTop: Spacing.three, marginBottom: Spacing.one },
  topCard: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  topTitle: { marginTop: Spacing.one },
  topMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: { flex: 1, gap: 2 },
  scorePill: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignItems: 'center',
  },
});
