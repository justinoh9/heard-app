import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { AlbumCover } from '@/components/album-cover';
import { BreadRating } from '@/components/bread-rating';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { ScoreInput } from '@/components/score-input';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { postComment } from '@/comments';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { sortRanked, type Placement } from '@/ranking/engine';
import type { Comparison, ComparisonEvent, Item, ItemType, RankedItem } from '@/ranking/types';

/** Fades content in on mount and whenever `stepKey` changes, masking the instant step cut. */
function useStepFade(stepKey: string) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [stepKey, opacity]);
  return opacity;
}

type Step = 'score' | 'compare' | 'review' | 'done';

export default function LogModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const user = useAuthGate();
  const params = useLocalSearchParams<{
    id: string;
    type?: string;
    title: string;
    artist: string;
    year?: string;
    artUrl?: string;
  }>();
  const { engine, ranked, ratingFor, commitPlacement } = useRatings();

  const album: Item = {
    id: String(params.id),
    type: (params.type as ItemType) || 'album',
    title: String(params.title),
    artist: String(params.artist),
    artUrl: params.artUrl || undefined,
    year: params.year || undefined,
  };
  const existing = ratingFor(album.id);
  // Capture at open time so the header doesn't flip to "Update" after committing.
  const [isUpdate] = useState(() => !!existing);

  const [step, setStep] = useState<Step>('score');
  const [score, setScore] = useState(existing?.score ?? 7.5);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [result, setResult] = useState<{ rank: number; total: number } | null>(null);
  const [pendingChoice, setPendingChoice] = useState<'new' | 'existing' | null>(null);
  const [reviewText, setReviewText] = useState('');
  const placement = useRef<Placement | null>(null);
  // The settled placement, captured when comparisons finish but not persisted
  // until the review step — so the optional review rides the same 'rated' feed
  // event (blueprint §4.3: review, then the log completes). Consumed by
  // submitReview; the unmount guard commits it review-less if the modal is
  // closed at the review step so completed work is never lost.
  const pendingCommit = useRef<{ list: RankedItem[]; events: ComparisonEvent[] } | null>(null);
  const commitRef = useRef(commitPlacement);
  commitRef.current = commitPlacement;

  useEffect(() => {
    return () => {
      const pending = pendingCommit.current;
      if (pending) {
        pendingCommit.current = null;
        commitRef.current(pending.list, pending.events, { item: album, score });
      }
    };
    // Runs once: the guard reads the latest values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance() {
    const next = placement.current!.next();
    if (next) setComparison(next);
    else finish();
  }

  function confirmScore() {
    haptics.success();
    // Re-rating replaces the old entry: place against the list without it.
    const base = ranked.filter((r) => r.item.id !== album.id);
    placement.current = engine.startPlacement(base, album, score);
    setStep('compare');
    advance();
  }

  function choose(winner: 'new' | 'existing') {
    if (pendingChoice) return;
    haptics.success();
    setPendingChoice(winner);
    // Brief highlight on the winning card before the next comparison appears.
    setTimeout(() => {
      placement.current!.choose(winner);
      advance();
      setPendingChoice(null);
    }, 220);
  }

  /** "Too close to call" — settle here without recording a preference. */
  function tooClose() {
    if (pendingChoice) return;
    placement.current!.tooClose();
    advance();
  }

  /** "Haven't heard it" — drop this opponent and ask about another. */
  function skipOpponent() {
    if (pendingChoice) return;
    placement.current!.skip();
    advance();
  }

  function finish() {
    // Placement is settled — hold the result and show the rank now, but defer
    // persistence + the 'rated' feed event to submitReview so the optional
    // review rides the same event. The unmount guard commits it review-less if
    // the modal is closed here, so a completed rating is never lost.
    const { list, events } = placement.current!.commit();
    pendingCommit.current = { list, events };
    const sorted = sortRanked(list);
    const idx = sorted.findIndex((r) => r.item.id === album.id);
    setResult({ rank: idx + 1, total: sorted.length });
    setStep('review');
  }

  function submitReview() {
    const body = reviewText.trim();
    const pending = pendingCommit.current;
    if (pending) {
      pendingCommit.current = null;
      commitPlacement(pending.list, pending.events, {
        item: album,
        score,
        review: body || undefined,
      });
    }
    if (body && user) {
      // Also keep the review on the item page (durable, likeable) — the feed
      // event is the timeline copy; this is the permanent one. Fire-and-forget:
      // don't gate the success screen on a network write.
      postComment({
        itemId: album.id,
        itemType: album.type === 'song' ? 'song' : 'album',
        itemTitle: album.title,
        itemArtist: album.artist,
        itemArtUrl: album.artUrl,
        userId: user.id,
        displayName: user.displayName,
        body,
      }).catch((e: unknown) => console.warn('Failed to post review', e));
    }
    setStep('done');
  }

  const stepKey = step === 'compare' && comparison ? `compare-${comparison.against.id}` : step;
  const fade = useStepFade(stepKey);

  // Redirect (above) is in flight; render nothing rather than a flash of the form.
  if (!user) return null;

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">
          {isUpdate ? 'Update rating' : `Rate ${album.type === 'song' ? 'song' : 'album'}`}
        </ThemedText>
        <View style={{ width: 26 }} />
      </View>

      {step === 'score' && (
        <Animated.View style={[styles.body, { opacity: fade }]}>
          <AlbumCover uri={album.artUrl} size={160} radius={12} />
          <ThemedText type="subtitle" style={styles.center}>
            {album.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {album.artist}
            {params.year ? ` · ${params.year}` : ''}
          </ThemedText>

          <ScoreInput value={score} onChange={setScore} />

          <Pressable
            testID="rate-confirm"
            onPress={confirmScore}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {isUpdate ? `Update to ${score.toFixed(1)}` : `Rate ${score.toFixed(1)}`}
            </ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {step === 'compare' && comparison && (
        <Animated.View style={[styles.body, { opacity: fade }]}>
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
              state={pendingChoice === null ? 'idle' : pendingChoice === 'new' ? 'won' : 'lost'}
            />
            <ThemedText type="small" themeColor="textSecondary">
              vs
            </ThemedText>
            <CompareCard
              testID="compare-existing"
              item={comparison.against}
              onPress={() => choose('existing')}
              theme={theme}
              state={pendingChoice === null ? 'idle' : pendingChoice === 'existing' ? 'won' : 'lost'}
            />
          </View>
          <View style={styles.escapeRow}>
            <Pressable
              testID="too-close"
              onPress={tooClose}
              style={({ pressed }) => [
                styles.escapeButton,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                Too close to call
              </ThemedText>
            </Pressable>
            <Pressable
              testID="havent-heard"
              onPress={skipOpponent}
              style={({ pressed }) => [
                styles.escapeButton,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                Haven&apos;t heard it
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'review' && (
        <Animated.View style={[styles.body, { opacity: fade }]}>
          <AlbumCover uri={album.artUrl} size={120} radius={12} />
          <ThemedText type="subtitle" style={styles.center}>
            Add a review?
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Public — anyone can see it on this album's page.
          </ThemedText>
          <TextField
            testID="review-input"
            label="Review (optional)"
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="What did you think?"
            multiline
            maxLength={1000}
            style={styles.reviewInput}
          />
          <Pressable
            testID="review-submit"
            onPress={submitReview}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {reviewText.trim() ? 'Post' : 'Skip'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {step === 'done' && result && (
        <Animated.View style={[styles.body, { opacity: fade }]}>
          <AlbumCover uri={album.artUrl} size={140} radius={12} />
          <Ionicons name="checkmark-circle" size={44} color={theme.accent} />
          <ThemedText type="subtitle" style={styles.center}>
            {album.title}
          </ThemedText>
          <BreadRating score={score} size={30} />
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Rated {score.toFixed(1)} · #{result.rank} of {result.total}
          </ThemedText>
          <Pressable
            testID="done"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Done
            </ThemedText>
          </Pressable>
        </Animated.View>
      )}
    </ModalDialogFrame>
  );
}

type CompareCardState = 'idle' | 'won' | 'lost';

function CompareCard({
  item,
  tag,
  onPress,
  theme,
  testID,
  state,
}: {
  item: Item;
  tag?: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  testID?: string;
  state: CompareCardState;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: state === 'won' ? 1.05 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(fade, {
      toValue: state === 'lost' ? 0.35 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [state, scale, fade]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
      <Pressable
        testID={testID}
        disabled={state !== 'idle'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.compareCard,
          {
            backgroundColor: theme.backgroundElement,
            opacity: pressed ? 0.6 : 1,
            borderColor: state === 'won' ? theme.accent : 'transparent',
          },
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  center: { textAlign: 'center' },
  escapeRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  escapeButton: {
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  reviewInput: { minHeight: 90, textAlignVertical: 'top' },
  versus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  compareCard: {
    width: 130,
    padding: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.08)',
    elevation: 2,
  },
});
