/**
 * Browse & discovery seam (ROADMAP G2): the non-social surfaces both Beli and
 * Letterboxd have — trending this week, top-rated, and by-genre — computed over
 * real `ratings`×`items` data. Screens talk to the `BrowseBackend`; the pure,
 * unit-tested aggregation lives in `aggregate.ts` (the same split as
 * leaderboard/rank.ts and social/feed-rows.ts).
 *
 * These are also the crawlable, ad-friendly pages that make the AdSense seam
 * earn (see `src/components/ad-slot.tsx`).
 */

import type { ItemType } from '@/ranking/types';

/** One rating joined to its item — the raw input the aggregation folds. */
export interface RatingWithItem {
  score: number;
  /** ISO timestamp of the rating, for the trending window. */
  createdAt: string;
  item: {
    id: string;
    type: ItemType;
    title: string;
    artist: string;
    artUrl?: string;
    releaseYear?: number;
    genres?: string[];
  };
}

/** One item with its community aggregates — the unit browse screens render. */
export interface BrowseItem {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
  releaseYear?: number;
  genres?: string[];
  /** Mean of all scores for this item. */
  avgScore: number;
  /** How many people have rated it. */
  ratingCount: number;
  /** How many of those ratings fell inside the trending window. */
  recentCount: number;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class BrowseError extends Error {}

export interface BrowseBackend {
  /**
   * Every rated item with its community aggregates. The backend fetches the raw
   * ratings×items rows and folds them through the pure `aggregateBrowseItems`;
   * screens then slice with `trending` / `topRated` / `forGenre`.
   */
  load(): Promise<BrowseItem[]>;
}
