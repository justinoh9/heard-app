/**
 * Pure data behind the share-card variants (ROADMAP Phase 3 "Share cards").
 * Kept separate from `export.ts` on purpose: that file pulls
 * react-native-view-shot / expo-sharing, which the node test runner can't
 * load — this one is types and folds only, so the variant logic stays
 * unit-testable.
 */

import { sortRanked } from '@/ranking/engine';
import type { RankedItem } from '@/ranking/types';

export interface CardMedia {
  title: string;
  artist: string;
  artUrl?: string;
  score: number;
}

export interface SpotlightData {
  /** Eyebrow label — "ARTIST ON REPEAT" / "MY DECADE". */
  label: string;
  /** The headline: the artist's name, or "1990s". */
  title: string;
  /** "5 rated · 8.7 avg". */
  caption: string;
  /** Up to four spotlit items, best first. */
  items: CardMedia[];
}

const COVERS = 4;

const toMedia = (r: RankedItem): CardMedia => ({
  title: r.item.title,
  artist: r.item.artist,
  artUrl: r.item.artUrl,
  score: r.score,
});

const mean = (scores: number[]) =>
  Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10;

const caption = (count: number, avg: number) => `${count} rated · ${avg.toFixed(1)} avg`;

/**
 * The most-rated artist (ties by mean score, then name) with their best-rated
 * items. Multi-credit strings ("A, B") count for each credited artist, same as
 * the Wrapped stats. Null until something is rated.
 */
export function artistSpotlight(ranked: RankedItem[]): SpotlightData | null {
  const byArtist = new Map<string, { name: string; entries: RankedItem[] }>();
  for (const r of sortRanked(ranked)) {
    for (const name of r.item.artist.split(',').map((a) => a.trim()).filter(Boolean)) {
      const key = name.toLowerCase();
      const entry = byArtist.get(key) ?? { name, entries: [] };
      entry.entries.push(r);
      byArtist.set(key, entry);
    }
  }
  const top = [...byArtist.values()]
    .map((a) => ({ ...a, avg: mean(a.entries.map((e) => e.score)) }))
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length || b.avg - a.avg || a.name.localeCompare(b.name),
    )[0];
  if (!top) return null;

  return {
    label: 'ARTIST ON REPEAT',
    title: top.name,
    caption: caption(top.entries.length, top.avg),
    // entries came from the sorted list, so they're already best-first.
    items: top.entries.slice(0, COVERS).map(toMedia),
  };
}

/**
 * The most-rated decade (ties to the newer one) with its best-rated items.
 * Null until a rated item carries a parseable year.
 */
export function decadeSpotlight(ranked: RankedItem[]): SpotlightData | null {
  const byDecade = new Map<number, RankedItem[]>();
  for (const r of sortRanked(ranked)) {
    const year = r.item.year ? Number.parseInt(r.item.year, 10) : NaN;
    if (!Number.isFinite(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    byDecade.set(decade, [...(byDecade.get(decade) ?? []), r]);
  }
  const top = [...byDecade.entries()].sort(
    (a, b) => b[1].length - a[1].length || b[0] - a[0],
  )[0];
  if (!top) return null;

  const [decade, entries] = top;
  return {
    label: 'MY DECADE',
    title: `${decade}s`,
    caption: caption(entries.length, mean(entries.map((e) => e.score))),
    items: entries.slice(0, COVERS).map(toMedia),
  };
}
