import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { FEED, type FeedEvent } from '@/data/catalog';
import { useFeed, type DailyDrop } from '@/feed/store';
import { relativeTime } from '@/feed/time';
import { useTheme } from '@/hooks/use-theme';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { myDrop } = useFeed();
  const drop = FEED.find((e) => e.kind === 'drop');
  const rest = FEED.filter((e) => e.kind !== 'drop');

  function openItem(event: FeedEvent) {
    if (!event.itemId || !event.itemType) return;
    router.push({
      pathname: '/item/[id]',
      params: {
        id: event.itemId,
        type: event.itemType,
        title: event.title,
        artist: event.artist ?? '',
        artUrl: event.coverUrl ?? '',
      },
    });
  }

  function openDropItem(d: DailyDrop) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: d.item.id,
        type: d.item.type,
        title: d.item.title,
        artist: d.item.artist,
        artUrl: d.item.artUrl ?? '',
      },
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <YourDrop
            drop={myDrop}
            theme={theme}
            onCompose={() => router.push('/drop')}
            onOpen={() => myDrop && openDropItem(myDrop)}
          />

          {drop && (
            <Pressable
              testID="feed-drop"
              onPress={() => openItem(drop)}
              style={[styles.dropCard, { borderColor: '#378ADD', backgroundColor: theme.backgroundElement }]}>
              <View style={styles.dropHeader}>
                <Ionicons name="radio" size={16} color="#378ADD" />
                <ThemedText type="small" style={{ color: '#378ADD' }}>
                  {drop.user}&apos;s drop · 2h left
                </ThemedText>
              </View>
              <View style={styles.dropBody}>
                <AlbumCover uri={drop.coverUrl} size={48} radius={8} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{drop.user} is listening to</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {drop.title}
                    {drop.artist ? ` — ${drop.artist}` : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          )}

          {rest.map((event) => (
            <FeedRow key={event.id} event={event} theme={theme} onPress={() => openItem(event)} />
          ))}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function YourDrop({
  drop,
  theme,
  onCompose,
  onOpen,
}: {
  drop: DailyDrop | null;
  theme: ReturnType<typeof useTheme>;
  onCompose: () => void;
  onOpen: () => void;
}) {
  if (!drop) {
    return (
      <Pressable
        testID="compose-drop"
        onPress={onCompose}
        style={({ pressed }) => [
          styles.promptCard,
          { borderColor: '#378ADD', opacity: pressed ? 0.7 : 1 },
        ]}>
        <View style={[styles.promptIcon, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="radio" size={20} color="#378ADD" />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">Share your daily drop</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Post what you&apos;re listening to right now
          </ThemedText>
        </View>
        <Ionicons name="add-circle" size={26} color="#378ADD" />
      </Pressable>
    );
  }

  return (
    <View style={[styles.dropCard, { borderColor: '#378ADD', backgroundColor: theme.backgroundElement }]}>
      <View style={styles.dropHeader}>
        <Ionicons name="radio" size={16} color="#378ADD" />
        <ThemedText type="small" style={{ color: '#378ADD', flex: 1 }}>
          Your daily drop · {relativeTime(drop.createdAt)}
        </ThemedText>
        <Pressable testID="replace-drop" onPress={onCompose} hitSlop={8} accessibilityLabel="Replace drop">
          <Ionicons name="repeat" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      <Pressable
        testID="open-drop"
        onPress={onOpen}
        style={({ pressed }) => [styles.dropBody, { opacity: pressed ? 0.7 : 1 }]}>
        <AlbumCover uri={drop.item.artUrl} size={48} radius={8} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {drop.item.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {drop.item.artist}
          </ThemedText>
          {drop.caption ? (
            <ThemedText type="small" style={styles.review} numberOfLines={2}>
              “{drop.caption}”
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function FeedRow({
  event,
  theme,
  onPress,
}: {
  event: FeedEvent;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const isRated = event.kind === 'rated';
  const Container = event.itemId ? Pressable : View;
  return (
    <Container
      testID={event.itemId ? `feed-item-${event.id}` : undefined}
      onPress={event.itemId ? onPress : undefined}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{event.initials}</ThemedText>
        </View>
        <ThemedText type="small" style={{ flex: 1 }}>
          <ThemedText type="smallBold">{event.user}</ThemedText>{' '}
          {isRated ? 'rated' : event.title}
          {isRated ? (
            <ThemedText type="smallBold"> {event.title}</ThemedText>
          ) : null}
        </ThemedText>
        {event.kind === 'streak' && <Ionicons name="flame" size={16} color="#EF9F27" />}
      </View>

      {isRated && (
        <View style={styles.ratedBody}>
          <AlbumCover uri={event.coverUrl} size={64} radius={8} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.scoreRow}>
              <View style={styles.scorePill}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  {event.score?.toFixed(1)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {event.artist}
              </ThemedText>
            </View>
            {event.review && (
              <ThemedText type="small" style={styles.review}>
                “{event.review}”
              </ThemedText>
            )}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Ionicons name="heart-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {event.likes}
          </ThemedText>
        </View>
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {event.comments}
          </ThemedText>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  dropCard: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  dropHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dropBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.three,
  },
  promptIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ratedBody: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  scorePill: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    alignItems: 'center',
  },
  review: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.four },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
