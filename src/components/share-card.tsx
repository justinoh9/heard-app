/**
 * The branded share cards (ROADMAP Phase 3). Fixed-size, screenshot-ready
 * summaries of a profile's taste that `src/share/export.ts` rasterizes to a
 * PNG — three variants (Wrapped, Top 4, spotlight) over one shell so every
 * export carries the wordmark + myjelli.site footer. Rendered and picked in
 * `app/share-card.tsx`; variant data comes from pure `src/share/cards.ts`.
 *
 * forwardRef so the capture can target the outer card view. Deliberately fixed
 * width (not responsive) so the exported image is consistent everywhere.
 */

import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useDisplayFont, useTheme } from '@/hooks/use-theme';
import type { CardMedia, SpotlightData } from '@/share/cards';

import { AlbumCover } from './album-cover';
import { ThemedText } from './themed-text';

export interface ShareCardData {
  name: string;
  handle?: string;
  ratedCount: number;
  meanScore: number | null;
  concertCount: number;
  topArtist?: string;
  /** The taste-profile rating style ("Generous", "Critical", …) — identity is
   *  what makes a card worth posting (Growth playbook: Social Currency). */
  descriptor?: string;
  highest?: { title: string; artist: string; artUrl?: string; score: number };
}

/** Who the card belongs to — the shell's header line. */
export interface CardOwner {
  name: string;
  handle?: string;
}

export const CARD_WIDTH = 340;

const CardShell = forwardRef<View, { owner: CardOwner; children: ReactNode }>(
  function CardShell({ owner, children }, ref) {
    const theme = useTheme();
    const displayFont = useDisplayFont();
    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          { backgroundColor: theme.background, borderColor: theme.backgroundElement },
        ]}>
        <View style={styles.header}>
          <ThemedText style={[styles.wordmark, { fontFamily: displayFont, color: theme.text }]}>
            jelli
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {owner.handle ? `@${owner.handle}` : owner.name}
          </ThemedText>
        </View>
        {children}
        <ThemedText type="small" style={[styles.footer, { color: theme.accent }]}>
          myjelli.site
        </ThemedText>
      </View>
    );
  },
);

export const ShareCard = forwardRef<View, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  const theme = useTheme();

  return (
    <CardShell ref={ref} owner={data}>
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

      {(data.descriptor || data.topArtist) && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
          {data.descriptor ? <ThemedText type="smallBold">{data.descriptor}</ThemedText> : null}
          {data.descriptor && data.topArtist ? ' · ' : ''}
          {data.topArtist ? (
            <>
              Most rated: <ThemedText type="smallBold">{data.topArtist}</ThemedText>
            </>
          ) : null}
        </ThemedText>
      )}
    </CardShell>
  );
});

/** The Top 4 showcase as a 2×2 grid — the profile's growth artifact, exportable. */
export const Top4Card = forwardRef<View, { owner: CardOwner; items: CardMedia[] }>(
  function Top4Card({ owner, items }, ref) {
    const theme = useTheme();
    return (
      <CardShell ref={ref} owner={owner}>
        <ThemedText
          type="smallBold"
          style={[styles.center, { color: theme.accent, letterSpacing: 1 }]}>
          MY TOP 4
        </ThemedText>
        <View style={styles.grid}>
          {items.slice(0, 4).map((m, i) => (
            <View key={`${m.title}-${i}`} style={styles.cell}>
              <AlbumCover uri={m.artUrl} fill radius={12} />
              <View style={styles.cellCaption}>
                <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                  {i + 1}. {m.title}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {m.score.toFixed(1)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {m.artist}
              </ThemedText>
            </View>
          ))}
        </View>
      </CardShell>
    );
  },
);

/** Per-artist / per-decade spotlight: eyebrow + headline + a cover grid. */
export const SpotlightCard = forwardRef<View, { owner: CardOwner; data: SpotlightData }>(
  function SpotlightCard({ owner, data }, ref) {
    const theme = useTheme();
    const displayFont = useDisplayFont();
    return (
      <CardShell ref={ref} owner={owner}>
        <View style={styles.spotlightHead}>
          <ThemedText type="smallBold" style={{ color: theme.accent, letterSpacing: 1 }}>
            {data.label}
          </ThemedText>
          <ThemedText
            numberOfLines={1}
            style={[styles.spotlightTitle, { fontFamily: displayFont, color: theme.text }]}>
            {data.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data.caption}
          </ThemedText>
        </View>
        <View style={styles.grid}>
          {data.items.slice(0, 4).map((m, i) => (
            <View key={`${m.title}-${i}`} style={styles.cell}>
              <AlbumCover uri={m.artUrl} fill radius={12} />
              <View style={styles.cellCaption}>
                <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>
                  {m.title}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {m.score.toFixed(1)}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </CardShell>
    );
  },
);

/** Shared-item art + title for the match card's "you both love" row. */
export interface MatchShared {
  title: string;
  artUrl?: string;
}

/**
 * The taste-match card (Growth playbook: Emotion + Social Currency): one
 * number about the *pair*, so both people look good sharing it. Exported from
 * another user's profile.
 */
export const MatchCard = forwardRef<
  View,
  { owner: CardOwner; other: CardOwner; percent: number; shared: MatchShared[] }
>(function MatchCard({ owner, other, percent, shared }, ref) {
  const theme = useTheme();
  const displayFont = useDisplayFont();
  return (
    <CardShell ref={ref} owner={owner}>
      <View style={styles.spotlightHead}>
        <ThemedText type="smallBold" style={{ color: theme.accent, letterSpacing: 1 }}>
          TASTE MATCH
        </ThemedText>
        <ThemedText style={[styles.matchPercent, { fontFamily: displayFont, color: theme.text }]}>
          {percent}%
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {owner.handle ? `@${owner.handle}` : owner.name} ×{' '}
          {other.handle ? `@${other.handle}` : other.name}
        </ThemedText>
      </View>
      {shared.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            You both love
          </ThemedText>
          <View style={styles.matchRow}>
            {shared.slice(0, 3).map((m, i) => (
              <View key={`${m.title}-${i}`} style={styles.matchItem}>
                <AlbumCover uri={m.artUrl} size={84} radius={10} />
                <ThemedText type="small" numberOfLines={1} style={styles.center}>
                  {m.title}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
    </CardShell>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: { flexBasis: '47%', flexGrow: 1, gap: 4 },
  cellCaption: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  spotlightHead: { alignItems: 'center', gap: 2 },
  spotlightTitle: { fontSize: 30, lineHeight: 36 },
  matchPercent: { fontSize: 44, lineHeight: 50 },
  matchRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  matchItem: { alignItems: 'center', gap: 4, maxWidth: 92 },
});
