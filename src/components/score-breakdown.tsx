import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { scoreColor } from '@/ranking/score';
import { formatCount, scoreBreakdown } from '@/social/scores';

/**
 * "Your score vs friends vs global" panel for an item page. Reads the mock
 * social breakdown (src/social/scores) and tints each figure with the shared
 * scoreColor scale so the rating and the breakdown speak the same visual
 * language.
 */
export function ScoreBreakdown({ itemId, yourScore }: { itemId: string; yourScore?: number }) {
  const theme = useTheme();
  const { you, friends, friendsAvg, globalAvg, globalCount } = scoreBreakdown(itemId, yourScore);

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
            friends.length
              ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`
              : 'No friends yet'
          }
          theme={theme}
        />
        <Tile
          value={globalAvg}
          label="Global"
          caption={`${formatCount(globalCount)} ratings`}
          theme={theme}
        />
      </View>

      {friends.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {friends.map((f) => (
            <View key={f.id} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.chipAvatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" style={styles.chipInitials}>
                  {f.initials}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {f.username}
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
