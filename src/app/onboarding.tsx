/**
 * Onboarding wizard (ROADMAP Phase 2 — the biggest D1-retention lever). Shown
 * once to a brand-new user (gated in the tabs layout via useOnboardingRedirect):
 *
 *   welcome → rapid-rate ~10 albums → follow taste-matched people → done
 *
 * Rapid-rate seeds the ranking engine + taste profile with real signal in a few
 * taps; the follow step reuses the compatibility algorithm to suggest people so
 * the feed isn't empty on day one. Ratings persist through the normal
 * commitPlacement path; a device-local flag stops the wizard reappearing.
 *
 * Seed source is the app's own catalog (real artwork). A Spotify-top-tracks
 * seed is a deliberate follow-up — Spotify user-OAuth is still gated behind its
 * dev-mode allowlist, so a Spotify-first flow would break for most signups.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ratingsBackend } from '@/data/ratings-provider';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { musicCatalog } from '@/music';
import type { Item, RankedItem } from '@/ranking/types';
import { initialsOf } from '@/social/feed-rows';
import { socialBackend } from '@/social/provider';
import { useSocial } from '@/social/store';

import { markOnboarded } from '@/onboarding/flag';
import { loadSeedAlbums } from '@/onboarding/seed';
import { rankFollowSuggestions, type FollowSuggestion, type SuggestionCandidate } from '@/onboarding/suggestions';

type Step = 'welcome' | 'rate' | 'follow' | 'done';

/** The three rapid-rate buckets → a representative score each. */
const BUCKETS: { label: string; sublabel: string; score: number; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Loved it', sublabel: '', score: 9.2, icon: 'heart' },
  { label: 'Liked it', sublabel: '', score: 7.8, icon: 'thumbs-up' },
  { label: 'It was OK', sublabel: '', score: 5.5, icon: 'remove' },
];

/** How many other users to consider for follow suggestions (prototype scale). */
const MAX_CANDIDATES = 15;
const MIN_RATINGS_TO_CONTINUE = 3;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { user } = useAuth();
  const { commitPlacement } = useRatings();
  const { toggleFollow, followingIds } = useSocial();

  const [step, setStep] = useState<Step>('welcome');

  // --- rapid-rate state ---
  const [seed, setSeed] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const picks = useRef<{ item: Item; score: number }[]>([]);
  const [pickCount, setPickCount] = useState(0); // mirror of picks.length for render

  // --- follow state ---
  const [suggestions, setSuggestions] = useState<FollowSuggestion[] | null>(null);

  const finish = useCallback(() => {
    if (user) markOnboarded(user.id).catch(() => {});
    router.replace('/');
  }, [user, router]);

  // Load the seed as soon as we enter the rate step.
  useEffect(() => {
    if (step !== 'rate' || seed) return;
    let cancelled = false;
    loadSeedAlbums(musicCatalog)
      .then((items) => {
        if (!cancelled) setSeed(items);
      })
      .catch(() => {
        if (!cancelled) setSeed([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, seed]);

  /** Build the fresh ranked list from the buckets and persist it. */
  const commitRatings = useCallback((): RankedItem[] => {
    const list: RankedItem[] = picks.current.map((p, i) => ({
      item: p.item,
      score: p.score,
      // Earlier picks sit slightly higher within a shared-score bucket.
      tiebreak: picks.current.length - i,
    }));
    if (list.length > 0) commitPlacement(list, []); // no per-item feed spam
    return list;
  }, [commitPlacement]);

  /** Load candidate users and rank them against the just-built list. */
  const loadSuggestions = useCallback(async (myList: RankedItem[]) => {
    setSuggestions(null);
    try {
      const profiles = await socialBackend.listProfiles();
      const candidateProfiles = profiles
        .filter((p) => p.userId !== user?.id && !followingIds.has(p.userId))
        .slice(0, MAX_CANDIDATES);
      const candidates: SuggestionCandidate[] = (
        await Promise.all(
          candidateProfiles.map(async (p) => {
            const snap = await ratingsBackend.load(p.userId).catch(() => null);
            if (!snap || snap.list.length === 0) return null;
            return { userId: p.userId, displayName: p.displayName, list: snap.list };
          }),
        )
      ).filter((c): c is SuggestionCandidate => c !== null);
      setSuggestions(rankFollowSuggestions(myList, candidates));
    } catch {
      setSuggestions([]);
    }
  }, [user?.id, followingIds]);

  function rate(score: number) {
    if (!seed) return;
    haptics.success();
    picks.current = [...picks.current, { item: seed[index], score }];
    setPickCount(picks.current.length);
    advance();
  }

  function skipAlbum() {
    haptics.selection();
    advance();
  }

  function advance() {
    if (!seed) return;
    if (index + 1 >= seed.length) toFollowStep();
    else setIndex((i) => i + 1);
  }

  function toFollowStep() {
    const myList = commitRatings();
    setStep('follow');
    loadSuggestions(myList);
  }

  if (!user) return null;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {step === 'welcome' ? 'Welcome' : step === 'rate' ? 'Build your taste' : step === 'follow' ? 'Find your people' : ''}
        </ThemedText>
        {step !== 'done' && (
          <Pressable testID="onboarding-skip" onPress={finish} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Skip
            </ThemedText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer maxWidth={460} style={styles.inner}>
          {step === 'welcome' && <Welcome theme={theme} onStart={() => setStep('rate')} />}

          {step === 'rate' && (
            <RateStep
              theme={theme}
              seed={seed}
              index={index}
              pickCount={pickCount}
              onRate={rate}
              onSkip={skipAlbum}
              onContinue={toFollowStep}
            />
          )}

          {step === 'follow' && (
            <FollowStep
              theme={theme}
              suggestions={suggestions}
              followingIds={followingIds}
              onToggleFollow={toggleFollow}
              onContinue={() => setStep('done')}
            />
          )}

          {step === 'done' && <DoneStep theme={theme} onFinish={finish} />}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function Welcome({ theme, onStart }: { theme: ThemeT; onStart: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name="sparkles" size={40} color={theme.accent} />
      </View>
      <ThemedText type="title" style={styles.center}>
        Welcome to Jelli
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Rate a few albums so your rankings feel like you — then we&apos;ll find people who
        share your taste. Takes about 30 seconds.
      </ThemedText>
      <Primary theme={theme} label="Let's go" onPress={onStart} testID="onboarding-start" />
    </View>
  );
}

function RateStep({
  theme,
  seed,
  index,
  pickCount,
  onRate,
  onSkip,
  onContinue,
}: {
  theme: ThemeT;
  seed: Item[] | null;
  index: number;
  pickCount: number;
  onRate: (score: number) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  if (!seed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          Loading albums…
        </ThemedText>
      </View>
    );
  }
  if (seed.length === 0) {
    return (
      <View style={styles.centered}>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Couldn&apos;t load albums right now.
        </ThemedText>
        <Primary theme={theme} label="Continue" onPress={onContinue} testID="onboarding-rate-continue" />
      </View>
    );
  }

  const album = seed[index];
  const canContinue = pickCount >= MIN_RATINGS_TO_CONTINUE;

  return (
    <View style={styles.centered}>
      <ThemedText type="small" themeColor="textSecondary">
        {index + 1} of {seed.length} · rated {pickCount}
      </ThemedText>
      <AlbumCover uri={album.artUrl} size={200} radius={16} />
      <ThemedText type="subtitle" style={styles.center} numberOfLines={2}>
        {album.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {album.artist}
        {album.year ? ` · ${album.year}` : ''}
      </ThemedText>

      <View style={styles.buckets}>
        {BUCKETS.map((b) => (
          <Pressable
            key={b.label}
            testID={`onboarding-bucket-${b.score}`}
            onPress={() => onRate(b.score)}
            style={({ pressed }) => [
              styles.bucket,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name={b.icon} size={22} color={theme.accent} />
            <ThemedText type="smallBold">{b.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.rateFooter}>
        <Pressable testID="onboarding-havent-heard" onPress={onSkip} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            Haven&apos;t heard it
          </ThemedText>
        </Pressable>
        {canContinue && (
          <Pressable testID="onboarding-rate-continue" onPress={onContinue} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Continue →
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FollowStep({
  theme,
  suggestions,
  followingIds,
  onToggleFollow,
  onContinue,
}: {
  theme: ThemeT;
  suggestions: FollowSuggestion[] | null;
  followingIds: Set<string>;
  onToggleFollow: (userId: string) => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.followWrap}>
      <ThemedText type="subtitle" style={styles.center}>
        People you might like
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Based on the music you just rated.
      </ThemedText>

      {suggestions === null && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.four }} />}

      {suggestions?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.center, { marginTop: Spacing.three }]}>
          No matches yet — as more people join, you&apos;ll see who shares your taste. You can
          always find people from the Feed.
        </ThemedText>
      )}

      {suggestions?.map((s) => {
        const following = followingIds.has(s.userId);
        return (
          <Surface key={s.userId} style={styles.suggestRow}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{initialsOf(s.displayName)}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {s.displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {s.percent}% match
                {s.sharedFavorites[0] ? ` · loves ${s.sharedFavorites[0].artist}` : ''}
              </ThemedText>
            </View>
            <Pressable
              testID={`onboarding-follow-${s.userId}`}
              onPress={() => onToggleFollow(s.userId)}
              style={({ pressed }) => [
                styles.followBtn,
                {
                  backgroundColor: following ? theme.backgroundSelected : theme.accent,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: following ? theme.text : theme.onAccent }}>
                {following ? 'Following' : 'Follow'}
              </ThemedText>
            </Pressable>
          </Surface>
        );
      })}

      {suggestions !== null && (
        <Primary theme={theme} label="Continue" onPress={onContinue} testID="onboarding-follow-continue" />
      )}
    </View>
  );
}

function DoneStep({ theme, onFinish }: { theme: ThemeT; onFinish: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name="checkmark" size={40} color={theme.accent} />
      </View>
      <ThemedText type="title" style={styles.center}>
        You&apos;re all set
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Your rankings are live. Rate more anytime from the Rate tab, and post a daily drop to
        show friends what you&apos;re listening to.
      </ThemedText>
      <Primary theme={theme} label="Start exploring" onPress={onFinish} testID="onboarding-done" />
    </View>
  );
}

function Primary({
  theme,
  label,
  onPress,
  testID,
}: {
  theme: ThemeT;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {label}
      </ThemedText>
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
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four },
  inner: { gap: Spacing.three },
  centered: { alignItems: 'center', gap: Spacing.three },
  center: { textAlign: 'center' },
  heroIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  buckets: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch', marginTop: Spacing.two },
  bucket: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  rateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  followWrap: { gap: Spacing.two },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  followBtn: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
