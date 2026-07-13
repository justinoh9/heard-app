/**
 * Pure recommendation logic (ROADMAP G3): "your taste twin rated this 9.2 and
 * you haven't heard it." The cheap, explainable v1 — not an ML project: take
 * the people you follow, keep their high ratings on music you haven't logged,
 * and attribute each pick to the most taste-compatible friend who loved it.
 *
 * React/Supabase-free (relative imports only) so it runs under the tsx node
 * test runner, like browse/aggregate.ts and social/compatibility.ts.
 */

import type { Item, RankedItem } from '../ranking/types';

/** A friend's full ranked list plus their taste match with the viewer. */
export interface FriendList {
  userId: string;
  userName: string;
  /** 0–100 taste match with the viewer (from social/compatibility). */
  compatibility: number;
  ratings: RankedItem[];
}

/** One "For you" pick: an item a friend loved that the viewer hasn't rated. */
export interface Recommendation {
  item: Item;
  /** The attributed friend's score for it. */
  friendScore: number;
  friendId: string;
  friendName: string;
  /** The attributed friend's taste match with the viewer. */
  compatibility: number;
}

/** Default floor for "a friend loved it" — matches compatibility's favorite bar. */
const DEFAULT_MIN_SCORE = 8;

/**
 * Rank recommendations from followed friends' high ratings, excluding anything
 * the viewer has already rated. Each candidate item is attributed to the friend
 * with the best taste match (ties → higher score), then the list is ordered by
 * how loved it is (friend score), breaking ties toward more-compatible friends.
 */
export function recommend(
  friends: FriendList[],
  ratedItemIds: Set<string>,
  opts: { minScore?: number; limit?: number } = {},
): Recommendation[] {
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  const limit = opts.limit ?? 20;

  // Best candidate per item: prefer the most-compatible recommender, then the
  // higher score, so attribution reads as "your closest taste twin who loved it".
  const best = new Map<string, Recommendation>();
  for (const friend of friends) {
    for (const r of friend.ratings) {
      if (r.score < minScore || ratedItemIds.has(r.item.id)) continue;
      const candidate: Recommendation = {
        item: r.item,
        friendScore: r.score,
        friendId: friend.userId,
        friendName: friend.userName,
        compatibility: friend.compatibility,
      };
      const held = best.get(r.item.id);
      if (
        !held ||
        candidate.compatibility > held.compatibility ||
        (candidate.compatibility === held.compatibility && candidate.friendScore > held.friendScore)
      ) {
        best.set(r.item.id, candidate);
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => {
      const byScore = b.friendScore - a.friendScore;
      if (byScore !== 0) return byScore;
      const byMatch = b.compatibility - a.compatibility;
      if (byMatch !== 0) return byMatch;
      return a.item.id.localeCompare(b.item.id);
    })
    .slice(0, limit);
}
