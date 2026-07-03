/**
 * Wrapped stats (PRODUCT_BLUEPRINT §2.D): the always-on "year in music"
 * rollup, recomputed from the ranked list + concert log. Pure and
 * deterministic — the /wrapped screen just renders this.
 */

import { sortRanked } from '@/ranking/engine';
import type { RankedItem } from '@/ranking/types';
import type { Concert } from '@/concerts/types';

export interface ArtistStat {
  name: string;
  count: number;
  meanScore: number;
}

export interface BucketStat {
  /** "0–2", "2–4", … "8–10". */
  label: string;
  count: number;
}

export interface WrappedStats {
  ratedCount: number;
  /** Null until something is rated. */
  meanScore: number | null;
  /** Five 2-point score buckets, low → high. Always length 5. */
  histogram: BucketStat[];
  /** Most-rated artists (ties broken by mean score), best first, top 5. */
  topArtists: ArtistStat[];
  /** Rated releases per decade ("2010s"), newest first, unknown years dropped. */
  topDecades: BucketStat[];
  /** The #1 ranked item. */
  highest: RankedItem | null;
  concertCount: number;
  /** Most-visited venue, when any show has one. */
  topVenue: string | null;
}

const BUCKETS = ['0–2', '2–4', '4–6', '6–8', '8–10'];

export function computeStats(ranked: RankedItem[], concerts: Concert[]): WrappedStats {
  const sorted = sortRanked(ranked);
  const ratedCount = sorted.length;

  const meanScore =
    ratedCount === 0
      ? null
      : Math.round((sorted.reduce((s, r) => s + r.score, 0) / ratedCount) * 10) / 10;

  const histogram: BucketStat[] = BUCKETS.map((label) => ({ label, count: 0 }));
  for (const r of sorted) {
    // score 10 belongs in the top bucket, not an out-of-range sixth one.
    histogram[Math.min(4, Math.floor(r.score / 2))].count += 1;
  }

  // Multi-credit strings ("A, B") count for each credited artist.
  const byArtist = new Map<string, { name: string; scores: number[] }>();
  for (const r of sorted) {
    for (const name of r.item.artist.split(',').map((a) => a.trim()).filter(Boolean)) {
      const key = name.toLowerCase();
      const entry = byArtist.get(key) ?? { name, scores: [] };
      entry.scores.push(r.score);
      byArtist.set(key, entry);
    }
  }
  const topArtists: ArtistStat[] = [...byArtist.values()]
    .map((a) => ({
      name: a.name,
      count: a.scores.length,
      meanScore: Math.round((a.scores.reduce((s, x) => s + x, 0) / a.scores.length) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count || b.meanScore - a.meanScore)
    .slice(0, 5);

  const byDecade = new Map<number, number>();
  for (const r of sorted) {
    const year = r.item.year ? Number.parseInt(r.item.year, 10) : NaN;
    if (!Number.isFinite(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    byDecade.set(decade, (byDecade.get(decade) ?? 0) + 1);
  }
  const topDecades: BucketStat[] = [...byDecade.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, count]) => ({ label: `${decade}s`, count }));

  const venues = new Map<string, number>();
  for (const c of concerts) {
    if (c.venue) venues.set(c.venue, (venues.get(c.venue) ?? 0) + 1);
  }
  const topVenue =
    [...venues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    ratedCount,
    meanScore,
    histogram,
    topArtists,
    topDecades,
    highest: sorted[0] ?? null,
    concertCount: concerts.length,
    topVenue,
  };
}
