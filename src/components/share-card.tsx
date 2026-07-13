/**
 * The branded share card (ROADMAP Phase 3). A fixed-size, screenshot-ready
 * summary of a profile's taste — wordmark, their #1, and headline stats — that
 * `src/share/export.ts` rasterizes to a PNG. Rendered by `app/share-card.tsx`.
 *
 * forwardRef so the capture can target the outer card view. Deliberately fixed
 * width (not responsive) so the exported image is consistent everywhere.
 */

import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useDisplayFont, useTheme } from '@/hooks/use-theme';

import { AlbumCover } from './album-cover';
import { ThemedText } from './themed-text';

export interface ShareCardData {
  name: string;
  handle?: string;
  ratedCount: number;
  meanScore: number | null;
  concertCount: number;
  topArtist?: string;
  highest?: { title: string; artist: string; artUrl?: string; score: number };
}

export const CARD_WIDTH = 340;

export const ShareCard = forwardRef<View, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  const theme = useTheme();
  const displayFont = useDisplayFont();

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <ThemedText style={[styles.wordmark, { fontFamily: displayFont, color: theme.text }]}>
          jelli
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.handle ? `@${data.handle}` : data.name}
        </ThemedText>
      </View>

      {data.highest && (
        <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={{ color: theme.accent, letterSpacing: 1 }}>
            MY #1
          </ThemedText>
          <AlbumCover uri={data.highest.artUrl} size={140} radius={12} />
          <ThemedText type="subtitle" numberOfLines={2} style={styles.heroTitle}>
            {data.highest.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {data.highest.artist}
          </ThemedText>
          <View style={[styles.scoreBadge, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {data.highest.score.toFixed(1)}
            </ThemedText>
          </View>
        </View>
      )}

      <View style={styles.stats}>
        <Stat value={String(data.ratedCount)} label="rated" />
        <Stat value={data.meanScore != null ? data.meanScore.toFixed(1) : '—'} label="avg" />
        <Stat value={String(data.concertCount)} label="shows" />
      </View>

      {data.topArtist && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
          Most rated: <ThemedText type="smallBold">{data.topArtist}</ThemedText>
        </ThemedText>
      )}

      <ThemedText type="small" style={[styles.footer, { color: theme.accent }]}>
        myjelli.site
      </ThemedText>
    </View>
  );
});

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle" style={{ fontSize: 22 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  wordmark: { fontSize: 26 },
  hero: { alignItems: 'center', borderRadius: 16, padding: Spacing.four, gap: Spacing.two },
  heroTitle: { textAlign: 'center', marginTop: Spacing.one },
  scoreBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    marginTop: Spacing.one,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  center: { textAlign: 'center' },
  footer: { textAlign: 'center', fontWeight: '600' },
});
