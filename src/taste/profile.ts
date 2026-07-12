/**
 * Taste profile (ROADMAP Phase 2): the compact "here's who you are" summary
 * shown on a profile — a rating-style descriptor, favorite decade, mean score,
 * and most-logged artists. Reuses the tested Wrapped rollup (computeStats) for
 * the artist/decade/mean math and adds the identity descriptor on top; pure and
 * deterministic so it runs under the tsx node test runner.
 *
 * Genres are a deliberate follow-up: the current catalog (iTunes) doesn't carry
 * a genre we persist, so a top-genres section would be empty. It arrives when
 * the genre pipeline (or Spotify artist genres) lands.
 */

import { computeStats, type ArtistStat, type BucketStat } from '@/data/stats';
import type { RankedItem } from '@/ranking/types';

/** Fewer than this and a taste descriptor isn't meaningful yet. */
export const MIN_FOR_STYLE = 3;

export type RatingStyleKey = 'new' | 'generous' | 'critical' | 'polarizing' | 'balanced';

export interface RatingStyle {
  key: RatingStyleKey;
  /** One or two words for a chip, e.g. "Generous". */
  label: string;
  /** A short second-person blurb. */
  blurb: string;
}

export interface TasteProfile {
  ratedCount: number;
  /** Null until anything is rated. */
  meanScore: number | null;
  style: RatingStyle;
  /** Most-logged artists, best first (up to 5). */
  topArtists: ArtistStat[];
  /** Favorite decade label ("2010s"), or null when no years are known. */
  topDecade: string | null;
  /** Rated releases per decade, newest first (for a fuller breakdown). */
  decades: BucketStat[];
}

const STYLES: Record<RatingStyleKey, RatingStyle> = {
  new: { key: 'new', label: 'Getting started', blurb: 'Rate a few more to reveal your style.' },
  generous: { key: 'generous', label: 'Generous', blurb: 'You rate high — plenty of love to give.' },
  critical: { key: 'critical', label: 'Critical', blurb: 'A tough ear — top marks are earned.' },
  polarizing: { key: 'polarizing', label: 'Polarizing', blurb: 'Love it or hate it — you skip the middle.' },
  balanced: { key: 'balanced', label: 'Balanced', blurb: 'A measured ear — you use the whole scale.' },
};

/**
 * Classify a rating temperament from the mean and the score histogram (five
 * 2-point buckets, low → high). Polarizing wins when there's real mass at BOTH
 * ends (a high mean alone is "generous", not polarizing); otherwise the mean
 * decides generous vs critical vs balanced.
 */
export function ratingStyle(
  meanScore: number | null,
  histogram: BucketStat[],
  ratedCount: number,
): RatingStyle {
  if (ratedCount < MIN_FOR_STYLE || meanScore === null) return STYLES.new;

  const n = ratedCount;
  const lowFrac = (histogram[0].count + histogram[1].count) / n; // 0–4
  const highFrac = histogram[4].count / n; // 8–10

  if (lowFrac >= 0.3 && highFrac >= 0.3) return STYLES.polarizing;
  if (meanScore >= 7.8) return STYLES.generous;
  if (meanScore <= 5.7) return STYLES.critical;
  return STYLES.balanced;
}

export function computeTasteProfile(ranked: RankedItem[]): TasteProfile {
  // Concerts aren't part of taste identity — pass an empty log.
  const stats = computeStats(ranked, []);
  return {
    ratedCount: stats.ratedCount,
    meanScore: stats.meanScore,
    style: ratingStyle(stats.meanScore, stats.histogram, stats.ratedCount),
    topArtists: stats.topArtists,
    topDecade: stats.topDecades[0]?.label ?? null,
    decades: stats.topDecades,
  };
}
