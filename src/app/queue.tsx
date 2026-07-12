/**
 * Want-to-listen queue (ROADMAP Phase 2 / G1). The viewer's bookmarked
 * songs/albums — the "what do I play next?" list, newest bookmark first.
 * Reads the live queue store so removing a bookmark updates in place. Tap a
 * row to open the item; the bookmark toggle removes it.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { QueueButton } from '@/components/queue-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQueue } from '@/queue/store';
import type { QueueItem } from '@/queue/types';

export default function QueueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { items, loading } = useQueue();

  function openItem(item: QueueItem) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: item.itemId,
        type: item.type,
        title: item.title,
        artist: item.artist,
        artUrl: item.artUrl ?? '',
      },
    });
  }

  const empty = !loading && items.length === 0;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Want to listen</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          {!user && (
            <EmptyState
              icon="bookmark-outline"
              message="Sign in to bookmark songs and albums to listen to later."
              ctaLabel="Sign in"
              onPressCta={() => router.push('/(auth)/sign-in')}
            />
          )}

          {user && empty && (
            <EmptyState
              icon="bookmark-outline"
              doodle="vinyl"
              message="Nothing queued yet. Tap the bookmark on any song or album to save it here for later."
              ctaLabel="Find music"
              onPressCta={() => router.push('/(tabs)/rate')}
            />
          )}

          {user && items.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {items.length} {items.length === 1 ? 'thing' : 'things'} to listen to
            </ThemedText>
          )}

          {items.map((item) => (
            <Pressable
              key={item.id}
              testID={`queue-${item.itemId}`}
              onPress={() => openItem(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
              ]}>
              <AlbumCover uri={item.artUrl} size={48} radius={8} />
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.artist}
                </ThemedText>
              </View>
              <QueueButton
                target={{
                  itemId: item.itemId,
                  type: item.type,
                  title: item.title,
                  artist: item.artist,
                  artUrl: item.artUrl,
                }}
              />
            </Pressable>
          ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
});
