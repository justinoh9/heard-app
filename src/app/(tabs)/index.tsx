import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { FEED, type FeedEvent } from '@/data/catalog';
import { useTheme } from '@/hooks/use-theme';

export default function FeedScreen() {
  const theme = useTheme();
  const drop = FEED.find((e) => e.kind === 'drop');
  const rest = FEED.filter((e) => e.kind !== 'drop');

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {drop && (
          <View style={[styles.dropCard, { borderColor: '#378ADD', backgroundColor: theme.backgroundElement }]}>
            <View style={styles.dropHeader}>
              <Ionicons name="radio" size={16} color="#378ADD" />
              <ThemedText type="small" style={{ color: '#378ADD' }}>
                Daily drop · 2h left
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
          </View>
        )}

        {rest.map((event) => (
          <FeedRow key={event.id} event={event} theme={theme} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function FeedRow({ event, theme }: { event: FeedEvent; theme: ReturnType<typeof useTheme> }) {
  const isRated = event.kind === 'rated';
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  dropCard: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  dropHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dropBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
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
