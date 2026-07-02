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
import { toDisplayEvent } from '@/social/feed-rows';
import { useSocial } from '@/social/store';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { myDrop } = useFeed();
  const { feed, followingIds } = useSocial();

  // Real activity (you + people you follow), rendered above the mock filler.
  const realEvents = feed.map(toDisplayEvent);
  const mockDrop = FEED.find((e) => e.kind === 'drop');
  const mockRest = FEED.filter((e) => e.kind !== 'drop');

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

          {followingIds.size === 0 && (
            <Pressable
              testID="find-friends"
              onPress={() => router.push('/people')}
              style={({ pressed }) => [
                styles.promptCard,
                { borderColor: '#1D9E75', opacity: pressed ? 0.7 : 1 },
              ]}>
              <View style={[styles.promptIcon, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="people" size={20} color="#1D9E75" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">Find friends</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Follow people to fill this feed with their ratings and drops
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>
          )}

          {realEvents.map((event) => (
            <FeedRow
              key={event.id}
              event={event}
              theme={theme}
              onPress={() => openItem(event)}
              onOpenUser={() =>
                event.userId &&
                router.push({
                  pathname: '/user/[id]',
                  params: { id: event.userId, name: event.user },
                })
              }
            />
          ))}

          {/* Mock filler so the feed never looks dead — clearly separated. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            From the community
          </ThemedText>

          {mockDrop && (
            <Pressable
              testID="feed-drop"
              onPress={() => openItem(mockDrop)}
              style={[styles.dropCard, { borderColor: '#378ADD', backgroundColor: theme.backgroundElement }]}>
              <View style={styles.dropHeader}>
                <Ionicons name="radio" size={16} color="#378ADD" />
                <ThemedText type="small" style={{ color: '#378ADD' }}>
                  {mockDrop.user}&apos;s drop · 2h left
                </ThemedText>
              </View>
              <View style={styles.dropBody}>
                <AlbumCover uri={mockDrop.coverUrl} size={48} radius={8} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{mockDrop.user} is listening to</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {mockDrop.title}
                    {mockDrop.artist ? ` — ${mockDrop.artist}` : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          )}

          {mockRest.map((event) => (
            <FeedRow key={event.id} event={event} theme={theme} onPress={() => openItem(event)} />
          ))}

          <Pressable
            testID="find-friends-footer"
            onPress={() => router.push('/people')}
            style={({ pressed }) => [styles.footerLink, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="person-add-outline" size={15} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Find more friends
            </ThemedText>
          </Pressable>
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

/** One activity card. Renders both real events (with timestamps) and mock rows. */
function FeedRow({
  event,
  theme,
  onPress,
  onOpenUser,
}: {
  event: FeedEvent;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  /** Set on real events — tapping the avatar opens the actor's profile. */
  onOpenUser?: () => void;
}) {
  const headerVerb =
    event.kind === 'rated'
      ? 'rated'
      : event.kind === 'drop'
        ? 'is listening to'
        : event.kind === 'concert'
          ? 'saw'
          : event.title;
  // Show the art+score body whenever there's something to show — AlbumCover
  // falls back to a disc icon, so a missing artUrl shouldn't hide the score.
  const showBody = event.kind !== 'streak' && (!!event.coverUrl || event.score != null);
  const Container = event.itemId ? Pressable : View;
  return (
    <Container
      testID={event.itemId ? `feed-item-${event.id}` : undefined}
      onPress={event.itemId ? onPress : undefined}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHeader}>
        <Pressable
          onPress={event.userId ? onOpenUser : undefined}
          disabled={!event.userId}
          accessibilityLabel={event.userId ? `View ${event.user}'s profile` : undefined}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{event.initials}</ThemedText>
        </Pressable>
        <ThemedText type="small" style={{ flex: 1 }}>
          <ThemedText type="smallBold">{event.user}</ThemedText> {headerVerb}
          {event.kind !== 'streak' ? (
            <ThemedText type="smallBold"> {event.title}</ThemedText>
          ) : null}
          {event.kind === 'concert' ? ' live' : ''}
        </ThemedText>
        {event.kind === 'streak' && <Ionicons name="flame" size={16} color="#EF9F27" />}
        {event.createdAt && (
          <ThemedText type="small" themeColor="textSecondary">
            {relativeTime(event.createdAt)}
          </ThemedText>
        )}
      </View>

      {showBody && (
        <View style={styles.ratedBody}>
          <AlbumCover
            uri={event.coverUrl}
            size={64}
            radius={8}
            fallbackIcon={event.kind === 'concert' ? 'mic' : 'disc-outline'}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.scoreRow}>
              {event.score != null && (
                <View style={styles.scorePill}>
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>
                    {event.score.toFixed(1)}
                  </ThemedText>
                </View>
              )}
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
  sectionLabel: { marginTop: Spacing.two },
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
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
