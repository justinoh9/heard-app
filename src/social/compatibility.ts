/**
 * Taste Compatibility Score (PRODUCT_BLUEPRINT §2.C): a deterministic, cheap,
 * explainable % match between two users' ranked lists.
 *
 *   score_sim  = 1 − mean(|a.score − b.score|) / 10   over items both rated
 *   coverage   = min(1, overlap / 15)                  (damps tiny-overlap noise)
 *   artist_sim = Jaccard(artistsA, artistsB)
 *   percent    = round(100 × (0.6 · score_sim · coverage + 0.4 · artist_sim))
 *
 * Pure — screens pass in both ranked lists (the viewer's from useRatings, the
 * other user's via RatingsBackend.load), so this is fully unit-testable.
 */

import type { Item, RankedItem } from '@/ranking/types';

/** Overlap needed before score similarity gets full weight. */
const FULL_COVERAGE_OVERLAP = 15;
/** Both users at/above this score makes an overlap item a "shared favorite". */
const FAVORITE_THRESHOLD = 8;

export interface Compatibility {
  /** 0–100. */
  percent: number;
  /** Items both users have rated. */
  overlapCount: number;
  /**
   * Up to 3 items driving the match ("You both love …"): overlap items both
   * scored ≥ 8, by combined score; falls back to the best-loved overlap when
   * nothing clears the bar.
   */
  sharedFavorites: Item[];
}

function artistKeySet(list: RankedItem[]): Set<string> {
  return new Set(
    list
      .map((r) => r.item.artist.trim().toLowerCase())
      .filter((a) => a.length > 0),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const key of a) if (b.has(key)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export function compatibility(mine: RankedItem[], theirs: RankedItem[]): Compatibility {
  const theirsById = new Map(theirs.map((r) => [r.item.id, r]));
  const overlap = mine
    .filter((r) => theirsById.has(r.item.id))
    .map((r) => ({ mine: r, theirs: theirsById.get(r.item.id)! }));

  let scoreSim = 0;
  if (overlap.length > 0) {
    const meanDiff =
      overlap.reduce((sum, p) => sum + Math.abs(p.mine.score - p.theirs.score), 0) /
      overlap.length;
    scoreSim = 1 - meanDiff / 10;
  }
  const coverage = Math.min(1, overlap.length / FULL_COVERAGE_OVERLAP);
  const artistSim = jaccard(artistKeySet(mine), artistKeySet(theirs));

  const percent = Math.round(100 * (0.6 * scoreSim * coverage + 0.4 * artistSim));

  const byCombined = [...overlap].sort(
    (a, b) => b.mine.score + b.theirs.score - (a.mine.score + a.theirs.score),
  );
  const loved = byCombined.filter(
    (p) => p.mine.score >= FAVORITE_THRESHOLD && p.theirs.score >= FAVORITE_THRESHOLD,
  );
  const sharedFavorites = (loved.length > 0 ? loved : byCombined)
    .slice(0, 3)
    .map((p) => p.mine.item);

  return { percent, overlapCount: overlap.length, sharedFavorites };
}
