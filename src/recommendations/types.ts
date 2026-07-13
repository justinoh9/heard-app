/**
 * Recommendations seam (ROADMAP G3). The screen-facing surface is the pure
 * `recommend.ts`; this backend only fetches the raw material — the followed
 * friends' ranked lists — so `recommend()` (with taste compatibility) can run
 * client-side, reusing data the app already stores.
 */

import type { RankedItem } from '@/ranking/types';

/** One followed friend's full ranked list. */
export interface FriendRatingList {
  userId: string;
  ratings: RankedItem[];
}

/** Thrown for expected persistence failures — UI-safe message. */
export class RecommendationsError extends Error {}

export interface RecommendationsBackend {
  /** The ranked lists of the given users (the viewer's followees). */
  friendLists(userIds: string[]): Promise<FriendRatingList[]>;
}
