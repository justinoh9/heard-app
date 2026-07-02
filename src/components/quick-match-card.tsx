import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { applyNudge, pickNudgePair } from '@/ranking/nudge';
import type { RankedItem } from '@/ranking/types';

/**
 * The re-rank nudge (PRODUCT_BLUEPRINT §2.B): one adjacent never-compared
 * pair from the user's list — "which do you prefer?". Same-score answers can
 * swap the order; every answer banks a comparison event for the future Elo
 * engine. Answering immediately surfaces the next pair; the X hides the card
 * until the screen remounts. Renders nothing when there's no pair left.
 */
export function QuickMatchCard() {
  const theme = useTheme();
  const haptics = useHaptics();
  const { ranked, comparisonLog, commitPlacement } = useRatings();
  const [dismissed, setDismissed] = useState(false);

  // Recomputes automatically after each answer: the commit changes
  // ranked/comparisonLog, which invalidates the memo and picks a fresh pair.
  const pair = useMemo(
    () => pickNudgePair(ranked, comparisonLog),
    [ranked, comparisonLog],
  );

  if (dismissed || !pair) return null;

  function answer(winner: 'above' | 'below') {
    if (!pair) return;
    haptics.success();
    const { list, event } = applyNudge(ranked, pair, winner);
    commitPlacement(list, [event]);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <Ionicons name="swap-vertical" size={14} color="#1D9E75" />
        <ThemedText type="small" style={{ color: '#1D9E75', flex: 1 }}>
          QUICK MATCH · sharpen your ranks
        </ThemedText>
        <Pressable
          testID="quick-match-dismiss"
          onPress={() => setDismissed(true)}
          accessibilityLabel="Hide quick match"
          hitSlop={8}>
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ThemedText type="smallBold">Which do you prefer?</ThemedText>
      <View style={styles.versus}>
        <Contender
          ranked={pair.above}
          testID="quick-match-above"
          onPress={() => answer('above')}
          theme={theme}
        />
        <ThemedText type="small" themeColor="textSecondary">
          vs
        </ThemedText>
        <Contender
          ranked={pair.below}
          testID="quick-match-below"
          onPress={() => answer('below')}
          theme={theme}
        />
      </View>
    </View>
  );
}

function Contender({
  ranked,
  onPress,
  theme,
  testID,
}: {
  ranked: RankedItem;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`Prefer ${ranked.item.title}`}
      style={({ pressed }) => [
        styles.contender,
        { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.6 : 1 },
      ]}>
      <AlbumCover uri={ranked.item.artUrl} size={64} radius={8} />
      <ThemedText type="small" numberOfLines={2} style={styles.title}>
        {ranked.item.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {ranked.item.artist}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  versus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  contender: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    padding: Spacing.two,
  },
  title: { textAlign: 'center', fontWeight: '600' },
});
