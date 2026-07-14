/**
 * Pure browse aggregation (ROADMAP G2). Folds raw ratings×items rows into
 * per-item community stats, then slices them into the discovery sections.
 * React/Supabase-free (relative imports only) so it runs under the tsx node
 * test runner, like leaderboard/rank.ts.
 */

import type { BrowseItem, RatingWithItem } from './types';

/** Trending looks at the last 7 days of rating activity. */
export const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** iTunes' catch-all genre carries no discovery signal — never a browse chip. */
const GENERIC_GENRES = new Set(['music', '']);

interface Accumulator {
  item: RatingWithItem['item'];
  sum: number;
  count: number;
  recent: number;
}

/**
 * Group ratings by item and compute avg score, total count, and how many landed
 * inside the trending window ending at `nowMs`. Item metadata is taken from the
 * first-seen row (the items cache is insert-only, so it's stable).
 */
export function aggregateBrowseItems(rows: RatingWithItem[], nowMs: number): BrowseItem[] {
  const byItem = new Map<string, Accumulator>();
  for (const row of rows) {
    const acc = byItem.get(row.item.id) ?? { item: row.item, sum: 0, count: 0, recent: 0 };
    acc.sum += row.score;
    acc.count += 1;
    const age = nowMs - Date.parse(row.createdAt);
    if (Number.isFinite(age) && age >= 0 && age <= TRENDING_WINDOW_MS) acc.recent += 1;
    byItem.set(row.item.id, acc);
  }
  return [...byItem.values()].map((a) => ({
    ...a.item,
    avgScore: a.sum / a.count,
    ratingCount: a.count,
    recentCount: a.recent,
  }));
}

/** Descending sort helper that breaks ties deterministically by id. */
function byScoreThen(primary: (i: BrowseItem) => number) {
  return (a: BrowseItem, b: BrowseItem): number => {
    const p = primary(b) - primary(a);
    if (p !== 0) return p;
    const s = b.avgScore - a.avgScore;
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  };
}

/**
 * Most-rated items in the trending window, hottest first. Only items with any
 * recent activity qualify — a stale all-time favorite isn't "trending".
 */
export function trending(items: BrowseItem[], limit = 20): BrowseItem[] {
  return items
    .filter((i) => i.recentCount > 0)
    .sort(byScoreThen((i) => i.recentCount))
    .slice(0, limit);
}

/**
 * Highest average score, gated by a minimum number of ratings so a single 10
 * doesn't top the chart. Ties break toward the more-rated item.
 */
export function topRated(items: BrowseItem[], minCount = 2, limit = 20): BrowseItem[] {
  return items
    .filter((i) => i.ratingCount >= minCount)
    .sort(byScoreThen((i) => i.avgScore))
    .slice(0, limit);
}

/** Case-insensitive membership — item genres come straight from iTunes. */
function hasGenre(item: BrowseItem, genre: string): boolean {
  const g = genre.toLowerCase();
  return (item.genres ?? []).some((x) => x.toLowerCase() === g);
}

/** Top-rated items within one genre. */
export function forGenre(items: BrowseItem[], genre: string, limit = 20): BrowseItem[] {
  return items
    .filter((i) => hasGenre(i, genre))
    .sort(byScoreThen((i) => i.avgScore))
    .slice(0, limit);
}

/**
 * Top-rated items matching ANY of several genre names — the curated genre
 * pages group iTunes' fine-grained labels (e.g. Electronic + Dance) under one
 * heading, so they filter with the whole alias list.
 */
export function forAnyGenre(items: BrowseItem[], genres: string[], limit = 20): BrowseItem[] {
  return items
    .filter((i) => genres.some((g) => hasGenre(i, g)))
    .sort(byScoreThen((i) => i.avgScore))
    .slice(0, limit);
}

/** "1990s"-style label for a release year; null when the item has no year. */
export function decadeOf(year: number | undefined): string | null {
  if (!year || !Number.isFinite(year)) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

/** Top-rated items released in one decade (label as produced by decadeOf). */
export function forDecade(items: BrowseItem[], decade: string, limit = 20): BrowseItem[] {
  return items
    .filter((i) => decadeOf(i.releaseYear) === decade)
    .sort(byScoreThen((i) => i.avgScore))
    .slice(0, limit);
}

/**
 * The decade chips worth showing: decades present on at least `minItems` rated
 * items, newest first (chronology reads better than popularity for eras).
 */
export function browseDecades(items: BrowseItem[], minItems = 1): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const d = decadeOf(item.releaseYear);
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minItems)
    .map(([d]) => d)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
}

/**
 * The genre chips worth showing: genres present on at least `minItems` rated
 * items, ordered by how many items carry them (most-represented first). The
 * generic "Music" bucket is dropped.
 */
export function browseGenres(items: BrowseItem[], minItems = 1): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const item of items) {
    for (const raw of item.genres ?? []) {
      const key = raw.toLowerCase();
      if (GENERIC_GENRES.has(key)) continue;
      const entry = counts.get(key) ?? { label: raw, n: 0 };
      entry.n += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .filter((e) => e.n >= minItems)
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .map((e) => e.label);
}
