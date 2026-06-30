import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { sortRanked, type Placement } from '@/ranking/engine';
import type { Comparison, Item } from '@/ranking/types';

type Step = 'pick' | 'score' | 'compare' | 'done';

export default function RateScreen() {
  const theme = useTheme();
  const { engine, ranked, unrated, commitPlacement } = useRatings();

  const [step, setStep] = useState<Step>('pick');
  const [chosen, setChosen] = useState<Item | null>(null);
  const [score, setScore] = useState(7.5);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [result, setResult] = useState<{ rank: number; total: number; score: number } | null>(null);
  const placement = useRef<Placement | null>(null);

  function reset() {
    placement.current = null;
    setChosen(null);
    setComparison(null);
    setResult(null);
    setScore(7.5);
    setStep('pick');
  }

  function startScoring(item: Item) {
    setChosen(item);
    setScore(7.5);
    setStep('score');
  }

  function advance() {
    const next = placement.current!.next();
    if (next) {
      setComparison(next);
    } else {
      finish();
    }
  }

  function confirmScore() {
    placement.current = engine.startPlacement(ranked, chosen!, score);
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
    const idx = sorted.findIndex((r) => r.item.id === chosen!.id);
    setResult({ rank: idx + 1, total: sorted.length, score });
    setStep('done');
  }

  function adjust(delta: number) {
    setScore((s) => Math.min(10, Math.max(0, Math.round((s + delta) * 10) / 10)));
  }

  if (step === 'pick') {
    return (
      <ThemedView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.list}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            PICK A SONG TO RATE
          </ThemedText>
          {unrated.length === 0 && (
            <ThemedText themeColor="textSecondary">You&apos;ve rated everything in the catalog.</ThemedText>
          )}
          {unrated.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => startScoring(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="musical-notes" size={20} color={theme.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.artist}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      </ThemedView>
    );
  }

  if (step === 'score') {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          HOW GOOD IS IT?
        </ThemedText>
        <ThemedText type="subtitle" style={styles.songTitle}>
          {chosen!.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{chosen!.artist}</ThemedText>

        <ThemedText style={styles.bigScore}>{score.toFixed(1)}</ThemedText>

        <View style={styles.stepperRow}>
          <StepButton label="-1" onPress={() => adjust(-1)} theme={theme} />
          <StepButton label="-0.5" onPress={() => adjust(-0.5)} theme={theme} />
          <StepButton label="+0.5" onPress={() => adjust(0.5)} theme={theme} />
          <StepButton label="+1" onPress={() => adjust(1)} theme={theme} />
        </View>

        <Pressable
          onPress={confirmScore}
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: Colors.dark.text }}>
            Rate {score.toFixed(1)}
          </ThemedText>
        </Pressable>
        <Pressable onPress={reset}>
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (step === 'compare' && comparison) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          SAME SCORE — WHICH IS BETTER?
        </ThemedText>
        <View style={styles.versus}>
          <CompareCard
            item={comparison.newItem}
            tag="new"
            onPress={() => choose('new')}
            theme={theme}
          />
          <ThemedText type="small" themeColor="textSecondary">
            vs
          </ThemedText>
          <CompareCard item={comparison.against} onPress={() => choose('existing')} theme={theme} />
        </View>
      </ThemedView>
    );
  }

  if (step === 'done' && result) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <Ionicons name="checkmark-circle" size={56} color="#1D9E75" />
        <ThemedText type="subtitle" style={styles.songTitle}>
          {chosen!.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Rated {result.score.toFixed(1)} · #{result.rank} of {result.total}
        </ThemedText>
        <Pressable
          onPress={reset}
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: Colors.dark.text }}>
            Rate another
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return null;
}

function StepButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
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
}: {
  item: Item;
  tag?: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compareCard,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={[styles.compareArt, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name="musical-notes" size={32} color={theme.textSecondary} />
      </View>
      <ThemedText type="smallBold" style={styles.center}>
        {item.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
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
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  list: { padding: Spacing.three, gap: Spacing.two },
  sectionLabel: { marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  rowText: { flex: 1, gap: 2 },
  art: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  songTitle: { textAlign: 'center' },
  bigScore: { fontSize: 72, fontWeight: 700, lineHeight: 80 },
  stepperRow: { flexDirection: 'row', gap: Spacing.two },
  stepBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 10, minWidth: 56, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  versus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  compareCard: { width: 130, padding: Spacing.three, borderRadius: 12, alignItems: 'center', gap: 4 },
  compareArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  center: { textAlign: 'center' },
});
