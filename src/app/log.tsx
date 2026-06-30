import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { coverArtUrl } from '@/music';
import { sortRanked, type Placement } from '@/ranking/engine';
import type { Comparison, Item } from '@/ranking/types';

type Step = 'score' | 'compare' | 'done';

export default function LogModal() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; title: string; artist: string; year?: string }>();
  const { engine, ranked, ratingFor, commitPlacement } = useRatings();

  const album: Item = {
    id: String(params.id),
    type: 'album',
    title: String(params.title),
    artist: String(params.artist),
    artUrl: coverArtUrl(String(params.id), 500),
  };
  const existing = ratingFor(album.id);
  // Capture at open time so the header doesn't flip to "Update" after committing.
  const [isUpdate] = useState(() => !!existing);

  const [step, setStep] = useState<Step>('score');
  const [score, setScore] = useState(existing?.score ?? 7.5);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [result, setResult] = useState<{ rank: number; total: number } | null>(null);
  const placement = useRef<Placement | null>(null);

  function adjust(delta: number) {
    setScore((s) => Math.min(10, Math.max(0, Math.round((s + delta) * 10) / 10)));
  }

  function advance() {
    const next = placement.current!.next();
    if (next) setComparison(next);
    else finish();
  }

  function confirmScore() {
    // Re-rating replaces the old entry: place against the list without it.
    const base = ranked.filter((r) => r.item.id !== album.id);
    placement.current = engine.startPlacement(base, album, score);
    setStep('compare');
    advance();
  }

  function choose(winner: 'new' | 'existing') {
    placement.current!.choose(winner);
    advance();
  }

  function finish() {
    const { list, events } = placement.current!.commit();
    commitPlacement(list, events);
    const sorted = sortRanked(list);
    const idx = sorted.findIndex((r) => r.item.id === album.id);
    setResult({ rank: idx + 1, total: sorted.length });
    setStep('done');
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{isUpdate ? 'Update rating' : 'Rate album'}</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      {step === 'score' && (
        <View style={styles.body}>
          <AlbumCover uri={album.artUrl} size={160} radius={12} />
          <ThemedText type="subtitle" style={styles.center}>
            {album.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {album.artist}
            {params.year ? ` · ${params.year}` : ''}
          </ThemedText>

          <ThemedText style={styles.bigScore}>{score.toFixed(1)}</ThemedText>
          <View style={styles.stepperRow}>
            {[-1, -0.1, 0.1, 1].map((d) => (
              <StepButton
                key={d}
                testID={`step-${d}`}
                label={d > 0 ? `+${d}` : `${d}`}
                onPress={() => adjust(d)}
                theme={theme}
              />
            ))}
          </View>

          <Pressable
            testID="rate-confirm"
            onPress={confirmScore}
            style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              {isUpdate ? `Update to ${score.toFixed(1)}` : `Rate ${score.toFixed(1)}`}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {step === 'compare' && comparison && (
        <View style={styles.body}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            SAME SCORE — WHICH IS BETTER?
          </ThemedText>
          <View style={styles.versus}>
            <CompareCard
              testID="compare-new"
              item={comparison.newItem}
              tag="new"
              onPress={() => choose('new')}
              theme={theme}
            />
            <ThemedText type="small" themeColor="textSecondary">
              vs
            </ThemedText>
            <CompareCard
              testID="compare-existing"
              item={comparison.against}
              onPress={() => choose('existing')}
              theme={theme}
            />
          </View>
        </View>
      )}

      {step === 'done' && result && (
        <View style={styles.body}>
          <AlbumCover uri={album.artUrl} size={140} radius={12} />
          <Ionicons name="checkmark-circle" size={44} color="#1D9E75" />
          <ThemedText type="subtitle" style={styles.center}>
            {album.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Rated {score.toFixed(1)} · #{result.rank} of {result.total}
          </ThemedText>
          <Pressable
            testID="done"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

function StepButton({
  label,
  onPress,
  theme,
  testID,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepBtn,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function CompareCard({
  item,
  tag,
  onPress,
  theme,
  testID,
}: {
  item: Item;
  tag?: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compareCard,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <AlbumCover uri={item.artUrl} fill radius={8} />
      <ThemedText type="smallBold" style={styles.center} numberOfLines={1}>
        {item.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center} numberOfLines={1}>
        {item.artist}
      </ThemedText>
      {tag && (
        <ThemedText type="small" themeColor="textSecondary">
          ({tag})
        </ThemedText>
      )}
    </Pressable>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  center: { textAlign: 'center' },
  bigScore: { fontSize: 72, fontWeight: 700, lineHeight: 80 },
  stepperRow: { flexDirection: 'row', gap: Spacing.two },
  stepBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    minWidth: 56,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  versus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  compareCard: { width: 130, padding: Spacing.three, borderRadius: 12, alignItems: 'center', gap: 4 },
});
