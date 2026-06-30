import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFeed, type DropItem } from '@/feed/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useMusicSearch, type SearchResult } from '@/music';

/**
 * Daily-drop composer: pick the song you're currently listening to and post it
 * to the top of the feed (audio-BeReal, SPEC §2/§3). Two states on one screen —
 * search for a track, then confirm with an optional caption.
 */
export default function DropModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { postDrop } = useFeed();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [caption, setCaption] = useState('');
  const { results, loading, error } = useMusicSearch(query, 'song');

  function share() {
    if (!selected) return;
    haptics.success();
    const item: DropItem = {
      id: selected.id,
      type: selected.kind,
      title: selected.title,
      artist: selected.artist,
      artUrl: selected.coverUrl,
    };
    postDrop({ item, caption });
    router.back();
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Daily drop</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      {selected ? (
        <View style={styles.confirm}>
          <View style={styles.dropHeader}>
            <Ionicons name="radio" size={16} color="#378ADD" />
            <ThemedText type="small" style={{ color: '#378ADD' }}>
              You&apos;re listening to
            </ThemedText>
          </View>
          <AlbumCover uri={selected.coverUrl} size={160} radius={12} />
          <ThemedText type="subtitle" style={styles.center} numberOfLines={2}>
            {selected.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center} numberOfLines={1}>
            {selected.artist}
          </ThemedText>

          <TextField
            label="Caption (optional)"
            value={caption}
            onChangeText={setCaption}
            placeholder="Say something about it"
            maxLength={140}
            style={styles.caption}
          />

          <Pressable
            testID="drop-share"
            onPress={share}
            style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              Share drop
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Pick a different song
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="What are you listening to?"
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
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
            keyExtractor={(s) => s.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              loading ? (
                <View style={styles.empty}>
                  <ActivityIndicator />
                </View>
              ) : (
                <EmptyState
                  icon={query ? 'sad-outline' : 'musical-notes'}
                  message={query ? `No songs found for “${query.trim()}”` : 'Find the song you have on.'}
                />
              )
            }
            ListHeaderComponent={
              loading && results.length > 0 ? (
                <ActivityIndicator style={{ marginBottom: Spacing.two }} />
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                testID="drop-result"
                onPress={() => setSelected(item)}
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
                    {item.albumTitle ? ` · ${item.albumTitle}` : ''}
                  </ThemedText>
                </View>
                <Ionicons name="radio-outline" size={22} color={theme.textSecondary} />
              </Pressable>
            )}
          />
        </>
      )}
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
  confirm: { flex: 1, alignItems: 'center', gap: Spacing.three, padding: Spacing.four },
  dropHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  caption: { alignSelf: 'stretch' },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
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
  empty: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.six },
});
