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

export interface BrowseLoadOptions {
  /**
   * Narrow to items carrying ANY of these genres, case-insensitively — the same
   * comparison `forAnyGenre` makes. A *hint*, not a contract: a backend may
   * return a superset (the local one does), so callers must still filter with the
   * pure functions. What it buys is that the Supabase backend can scope the query
   * server-side instead of shipping the world to filter three albums out of it.
   */
  genres?: string[];
}

export interface BrowseBackend {
  /**
   * Rated items with their community aggregates. Screens slice the result with
   * `trending` / `topRated` / `forGenre` / `forDecade`.
   *
   * Deliberately NOT "every rated item": the Supabase backend returns the top
   * slice of each section (see 0024_browse_rpc.sql). Reading every rating to
   * render twenty covers stopped scaling long before it stopped working — and it
   * would have stopped *working* silently, by truncation, which is worse.
   */
  load(options?: BrowseLoadOptions): Promise<BrowseItem[]>;
}
