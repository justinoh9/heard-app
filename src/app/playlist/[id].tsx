import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useMusicSearch, type SearchResult } from '@/music';
import { hasSong, songCountLabel } from '@/playlists/helpers';
import { usePlaylists } from '@/playlists/store';
import type { PlaylistSong } from '@/playlists/types';

export default function PlaylistDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id);
  const { getPlaylist, addSong, removeSong, deletePlaylist } = usePlaylists();
  const playlist = getPlaylist(id);

  const [query, setQuery] = useState('');
  const { results, loading, error } = useMusicSearch(query, 'song');
  const searching = query.trim().length > 0;

  if (!playlist) {
    return (
      <ThemedView style={styles.screen}>
        <TopBar title="Playlist" onBack={() => router.back()} theme={theme} />
        <EmptyState icon="alert-circle-outline" message="Playlist not found." />
      </ThemedView>
    );
  }

  function add(r: SearchResult) {
    haptics.selection();
    addSong(playlist!.id, {
      id: r.id,
      title: r.title,
      artist: r.artist,
      artUrl: r.coverUrl,
      kind: r.kind,
    });
  }

  function destroy() {
    haptics.success();
    deletePlaylist(playlist!.id);
    router.back();
  }

  const data = (searching ? results : playlist.songs) as (SearchResult | PlaylistSong)[];

  return (
    <ThemedView style={styles.screen}>
      <TopBar
        title={playlist.name}
        onBack={() => router.back()}
        onDelete={destroy}
        theme={theme}
      />

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add a song"
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

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          searching ? (
            loading && results.length > 0 ? (
              <ActivityIndicator style={{ marginBottom: Spacing.two }} />
            ) : null
          ) : playlist.songs.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.countLabel}>
              {songCountLabel(playlist.songs.length)}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          searching ? (
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator />
              </View>
            ) : (
              <EmptyState icon="sad-outline" message={`No songs found for “${query.trim()}”`} />
            )
          ) : (
            <EmptyState icon="musical-notes-outline" message="No songs yet. Search above to add some." />
          )
        }
        renderItem={({ item }) =>
          searching ? (
            <ResultRow
              result={item as SearchResult}
              added={hasSong(playlist.songs, item.id)}
              onAdd={() => add(item as SearchResult)}
              theme={theme}
            />
          ) : (
            <SongRow
              song={item as PlaylistSong}
              onRemove={() => {
                haptics.selection();
                removeSong(playlist.id, item.id);
              }}
              theme={theme}
            />
          )
        }
      />
    </ThemedView>
  );
}

function TopBar({
  title,
  onBack,
  onDelete,
  theme,
}: {
  title: string;
  onBack: () => void;
  onDelete?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </Pressable>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.topTitle}>
        {title}
      </ThemedText>
      {onDelete ? (
        <Pressable onPress={onDelete} accessibilityLabel="Delete playlist" hitSlop={8}>
          <Ionicons name="trash-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      ) : (
        <View style={{ width: 26 }} />
      )}
    </View>
  );
}

function ResultRow({
  result,
  added,
  onAdd,
  theme,
}: {
  result: SearchResult;
  added: boolean;
  onAdd: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      testID="playlist-add-result"
      onPress={added ? undefined : onAdd}
      disabled={added}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <AlbumCover uri={result.coverUrl} size={48} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {result.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {result.artist}
          {result.albumTitle ? ` · ${result.albumTitle}` : ''}
        </ThemedText>
      </View>
      <Ionicons
        name={added ? 'checkmark-circle' : 'add-circle-outline'}
        size={24}
        color={added ? '#1D9E75' : theme.textSecondary}
      />
    </Pressable>
  );
}

function SongRow({
  song,
  onRemove,
  theme,
}: {
  song: PlaylistSong;
  onRemove: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <AlbumCover uri={song.artUrl} size={48} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {song.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {song.artist}
        </ThemedText>
      </View>
      <Pressable testID="playlist-remove-song" onPress={onRemove} accessibilityLabel="Remove song" hitSlop={8}>
        <Ionicons name="remove-circle-outline" size={24} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#E24B4A', paddingHorizontal: Spacing.four, marginTop: Spacing.two },
  list: { padding: Spacing.three, gap: Spacing.two },
  countLabel: { marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 12,
  },
  rowText: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.six },
});
