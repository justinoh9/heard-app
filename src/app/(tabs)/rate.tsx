import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { useAlbumSearch, type AlbumSearchResult } from '@/music';

export default function RateSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ratingFor } = useRatings();
  const [query, setQuery] = useState('');
  const { results, loading, error } = useAlbumSearch(query);

  function openLog(album: AlbumSearchResult) {
    router.push({
      pathname: '/log',
      params: {
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year ?? '',
      },
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search albums or artists"
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
        data={results}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState query={query} loading={loading} theme={theme} />}
        ListHeaderComponent={
          loading && results.length > 0 ? (
            <ActivityIndicator style={{ marginBottom: Spacing.two }} />
          ) : null
        }
        renderItem={({ item }) => {
          const existing = ratingFor(item.id);
          return (
            <Pressable
              testID="album-result"
              onPress={() => openLog(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <AlbumCover uri={item.coverUrl} size={56} />
              <View style={styles.rowText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.artist}
                  {item.year ? ` · ${item.year}` : ''}
                </ThemedText>
              </View>
              {existing ? (
                <View style={styles.scorePill}>
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>
                    {existing.score.toFixed(1)}
                  </ThemedText>
                </View>
              ) : (
                <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
              )}
            </Pressable>
          );
        }}
      />
    </ThemedView>
  );
}

function EmptyState({
  query,
  loading,
  theme,
}: {
  query: string;
  loading: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Ionicons name={query ? 'sad-outline' : 'search'} size={32} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {query ? `No albums found for “${query.trim()}”` : 'Find an album to rate.'}
      </ThemedText>
    </View>
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
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 12,
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
  empty: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.six },
  center: { textAlign: 'center' },
});
