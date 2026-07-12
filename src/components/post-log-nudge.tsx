import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { applyNudge, pickNudgeForItem } from '@/ranking/nudge';
import type { RankedItem } from '@/ranking/types';

/**
 * Re-rank nudge v2 (PRODUCT_BLUEPRINT §2.B): a *post-log* quick match shown on
 * the log flow's done screen. It compares the item just rated against a
 * never-compared neighbour, so a single rating passively banks a comparison
 * (feeding the future Elo engine) and can sharpen a same-score tie on the spot.
 * Renders nothing when the item has no uncompared neighbour, or once answered.
 * The 1-in-N gate lives in the caller (done step); this only renders when asked.
 */
export function PostLogNudge({ itemId }: { itemId: string }) {
  const theme = useTheme();
  const haptics = useHaptics();
  const { ranked, comparisonLog, commitPlacement } = useRatings();
  // Freeze the pair to the moment the done screen mounts: after we bank the
  // answer the log changes, which would otherwise re-pick and flicker in a new
  // pair the user didn't ask for.
  const [answered, setAnswered] = useState(false);
  const pair = useMemo(
    () => pickNudgeForItem(ranked, comparisonLog, itemId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemId],
  );

  if (!pair) return null;

  function answer(winner: 'above' | 'below') {
    if (!pair || answered) return;
    haptics.success();
    const { list, event } = applyNudge(ranked, pair, winner);
    commitPlacement(list, [event]);
    setAnswered(true);
  }

  if (answered) {
    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={14} color={theme.accent} />
          <ThemedText type="small" style={{ color: theme.accent }}>
            Noted — that sharpened your ranks
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <Ionicons name="swap-vertical" size={14} color={theme.accent} />
        <ThemedText type="small" style={{ color: theme.accent }}>
          ONE QUICK MATCH
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.center}>
        Which do you prefer?
      </ThemedText>
      <View style={styles.versus}>
        <Contender
          ranked={pair.above}
          testID="post-log-nudge-above"
          onPress={() => answer('above')}
          theme={theme}
        />
        <ThemedText type="small" themeColor="textSecondary">
          vs
        </ThemedText>
        <Contender
          ranked={pair.below}
          testID="post-log-nudge-below"
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
      <AlbumCover uri={ranked.item.artUrl} size={56} radius={8} />
      <ThemedText type="small" numberOfLines={2} style={styles.title}>
        {ranked.item.title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two, width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  center: { textAlign: 'center' },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  contender: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    padding: Spacing.two,
  },
  title: { textAlign: 'center', fontWeight: '600' },
});
