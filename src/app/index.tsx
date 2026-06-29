import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

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
              <View style={[styles.playArt, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="play" size={18} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{drop.user} {drop.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {drop.subtitle}
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
  return (
    <View style={[styles.feedRow, { borderBottomColor: theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{event.initials}</ThemedText>
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="small">
          <ThemedText type="smallBold">{event.user}</ThemedText> {event.title}
        </ThemedText>
        {(event.score != null || event.subtitle) && (
          <View style={styles.metaRow}>
            {event.score != null && (
              <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                {event.score.toFixed(1)}
              </ThemedText>
            )}
            {event.subtitle && (
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                {event.subtitle}
              </ThemedText>
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  dropCard: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  dropHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dropBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  playArt: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  feedRow: { flexDirection: 'row', gap: Spacing.three, paddingBottom: Spacing.three, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: 3 },
  actions: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
