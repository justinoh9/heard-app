/**
 * Recommendations seam (ROADMAP G3). The screen-facing surface is the pure
 * `recommend.ts`; this backend only fetches the raw material — the followed
 * friends' ranked lists — so `recommend()` (with taste compatibility) can run
 * client-side, reusing data the app already stores.
 */

import type { RankedItem } from '@/ranking/types';

/**
 * A friend's rating with when they logged it. `ratedAt` feeds the taste-twin
 * notification's recency window; it's optional because the local backend's
 * snapshots don't record timestamps — a rating without one simply never
 * counts as "recent".
 */
export type FriendRating = RankedItem & { ratedAt?: string };

/** One followed friend's full ranked list. */
export interface FriendRatingList {
  userId: string;
  ratings: FriendRating[];
}

/** Thrown for expected persistence failures — UI-safe message. */
export class RecommendationsError extends Error {}

export interface RecommendationsBackend {
  /** The ranked lists of the given users (the viewer's followees). */
  friendLists(userIds: string[]): Promise<FriendRatingList[]>;
}
