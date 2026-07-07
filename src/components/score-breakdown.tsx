import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { scoreColor } from '@/ranking/score';
import { formatCount } from '@/social/item-scores';
import { useItemScores } from '@/social/use-item-scores';

/**
 * "Your score vs friends vs global" panel for an item page. Reads real ratings
 * through useItemScores (Supabase behind the SocialBackend seam, pure
 * aggregation) and tints each figure with the shared scoreColor scale so the
 * rating and the breakdown speak the same visual language. Every number is real
 * or an honest empty state — never fabricated.
 */
export function ScoreBreakdown({ itemId, yourScore }: { itemId: string; yourScore?: number }) {
  const theme = useTheme();
  const { summary, loading, error } = useItemScores(itemId, yourScore);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: Spacing.two }} />;
  }

  if (error) {
    return (
      <ThemedText type="small" style={{ color: theme.danger }}>
        {error}
      </ThemedText>
    );
  }

  if (!summary) return null;

  const { you, friends, friendsAvg, globalAvg, globalCount } = summary;
  const hasFriends = friends.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.tiles}>
        <Tile
          value={you}
          label="You"
          caption={you === undefined ? 'Not rated' : 'Your rating'}
          theme={theme}
        />
        <Tile
          value={friendsAvg}
          label="Friends"
          caption={
            hasFriends
              ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`
              : 'None yet'
          }
          theme={theme}
        />
        <Tile
          value={globalAvg}
          label="Global"
          caption={
            globalCount === 0
              ? 'No ratings'
              : `${formatCount(globalCount)} ${globalCount === 1 ? 'rating' : 'ratings'}`
          }
          theme={theme}
        />
      </View>

      {globalCount === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No ratings yet — be the first.
        </ThemedText>
      )}

      {hasFriends && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {friends.map((f) => (
            <View key={f.userId} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.chipAvatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" style={styles.chipInitials}>
                  {f.initials}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {f.displayName}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: scoreColor(f.score) }}>
                {f.score.toFixed(1)}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Tile({
  value,
  label,
  caption,
  theme,
}: {
  value: number | undefined;
  label: string;
  caption: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText
        type="subtitle"
        style={[styles.tileValue, { color: value === undefined ? theme.textSecondary : scoreColor(value) }]}>
        {value === undefined ? '—' : value.toFixed(1)}
      </ThemedText>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {caption}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, alignSelf: 'stretch' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    gap: 2,
  },
  tileValue: { fontSize: 30, lineHeight: 36 },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  chipAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipInitials: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
