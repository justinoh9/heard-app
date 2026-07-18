import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import {
  ShareCard,
  SpotlightCard,
  Top4Card,
  type CardOwner,
  type ShareCardData,
} from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAnalytics } from '@/analytics/store';
import { useToast } from '@/components/toast';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { computeStats } from '@/data/stats';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { artistSpotlight, decadeSpotlight } from '@/share/cards';
import { shareCard } from '@/share/export';
import { resolveFavorites } from '@/social/favorites';
import { useSocial } from '@/social/store';

/**
 * Share-card preview + export (ROADMAP Phase 3). Renders the branded card —
 * Wrapped, Top 4, or an artist/decade spotlight — and hands it to `shareCard`
 * (native share sheet / web download). Reached from the Wrapped screen's share
 * action. Variants with nothing to show simply don't offer their chip.
 */

type Variant = 'wrapped' | 'top4' | 'artist' | 'decade';

const VARIANT_LABELS: Record<Variant, string> = {
  wrapped: 'Wrapped',
  top4: 'Top 4',
  artist: 'Artist',
  decade: 'Decade',
};

export default function ShareCardModal() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useAuthGate();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { myProfile, myFavorites } = useSocial();
  const { track } = useAnalytics();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState<Variant>('wrapped');

  const artist = useMemo(() => artistSpotlight(ranked), [ranked]);
  const decade = useMemo(() => decadeSpotlight(ranked), [ranked]);

  if (!user) return null;

  const owner: CardOwner = { name: user.displayName, handle: myProfile?.handle };

  const stats = computeStats(ranked, concerts);
  const wrapped: ShareCardData = {
    ...owner,
    ratedCount: stats.ratedCount,
    meanScore: stats.meanScore,
    concertCount: stats.concertCount,
    topArtist: stats.topArtists[0]?.name,
    highest: stats.highest
      ? {
          title: stats.highest.item.title,
          artist: stats.highest.item.artist,
          artUrl: stats.highest.item.artUrl,
          score: stats.highest.score,
        }
      : undefined,
  };

  const top4 = resolveFavorites(myFavorites, ranked).items.map((r) => ({
    title: r.item.title,
    artist: r.item.artist,
    artUrl: r.item.artUrl,
    score: r.score,
  }));

  const available: Variant[] = [
    'wrapped',
    ...(top4.length > 0 ? (['top4'] as const) : []),
    ...(artist ? (['artist'] as const) : []),
    ...(decade ? (['decade'] as const) : []),
  ];

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      await shareCard(cardRef.current, `jelli-${myProfile?.handle ?? 'card'}-${variant}`);
      // Only after the export succeeds — every card carries the wordmark, so this
      // counts the acquisition surface actually leaving the building, not someone
      // tapping a button that then threw.
      track('shared', { surface: `${variant}_card`, platform: Platform.OS });
      if (Platform.OS === 'web') toast('Image saved', '📸');
    } catch (e) {
      console.warn('[share-card] export failed:', e);
      toast('Could not export the card', '⚠️');
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = Platform.OS === 'web' ? 'Save image' : 'Share';

  return (
    <ThemedView style={styles.screen}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Close"
        hitSlop={8}
        style={styles.close}>
        <Ionicons name="close" size={28} color={theme.text} />
      </Pressable>

      <View style={styles.body}>
        {available.length > 1 && (
          <View style={styles.chips}>
            {available.map((v) => {
              const selected = v === variant;
              return (
                <Pressable
                  key={v}
                  onPress={() => setVariant(v)}
                  accessibilityLabel={`${VARIANT_LABELS[v]} card`}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? theme.accent : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? theme.onAccent : theme.text }}>
                    {VARIANT_LABELS[v]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {variant === 'wrapped' && <ShareCard ref={cardRef} data={wrapped} />}
        {variant === 'top4' && <Top4Card ref={cardRef} owner={owner} items={top4} />}
        {variant === 'artist' && artist && (
          <SpotlightCard ref={cardRef} owner={owner} data={artist} />
        )}
        {variant === 'decade' && decade && (
          <SpotlightCard ref={cardRef} owner={owner} data={decade} />
        )}

        <Pressable
          testID="share-card-action"
          onPress={onShare}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={theme.onAccent} />
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {actionLabel}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  close: { alignSelf: 'flex-end', padding: Spacing.three },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  chips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
  },
});
