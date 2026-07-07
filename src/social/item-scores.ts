/**
 * Pure aggregation for the item-page score breakdown: turn one item's raw
 * ratings into "you / friends / global" figures. Replaces the old deterministic
 * fake generator (src/social/scores.ts) — every number here is a real mean over
 * real ratings rows, or an honest empty state. Never fabricated (ROADMAP goal #4).
 *
 * Relative imports only so it runs under the tsx node test runner, like the
 * ranking/feed helpers.
 */

import { snapScore } from '../ranking/score';

import { initialsOf } from './feed-rows';
import type { ItemRating } from './types';

/** One friend's rating of the item, resolved to a display name. */
export interface FriendScore {
  userId: string;
  displayName: string;
  initials: string;
  score: number;
}

export interface ItemScoreSummary {
  /** The viewer's own score, if they've rated it (passed through, not computed). */
  you?: number;
  /** Ratings by people the viewer follows (viewer excluded — that's `you`). */
  friends: FriendScore[];
  /** Mean of `friends`, or undefined when none have rated it. */
  friendsAvg?: number;
  /** Mean across every rating of the item, or undefined when there are none. */
  globalAvg?: number;
  /** Total number of ratings — powers the "N ratings" caption and empty state. */
  globalCount: number;
}

/** Mean of a non-empty score list, snapped to the 0.1 rating granularity. */
function meanScore(scores: number[]): number {
  return snapScore(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

export interface SummarizeOptions {
  /** The viewer's own score, surfaced as "You" (and kept out of the friends list). */
  yourScore?: number;
  /** Ids the viewer follows. */
  followingIds: Set<string>;
  /** Resolve a user id to a display name (falls back to a generic label). */
  nameFor: (userId: string) => string;
  /** The viewer's own id, so their row is never double-counted as a friend. */
  viewerId?: string | null;
}

/**
 * Assemble the breakdown. Global spans *every* rating (including the viewer's
 * and friends'); friends are the followed subset minus the viewer themselves.
 * Friends are sorted highest score first, ties broken by name for stability.
 */
export function summarizeItemScores(
  ratings: ItemRating[],
  opts: SummarizeOptions,
): ItemScoreSummary {
  const { yourScore, followingIds, nameFor, viewerId } = opts;

  const friends: FriendScore[] = ratings
    .filter((r) => r.userId !== viewerId && followingIds.has(r.userId))
    .map((r) => {
      const displayName = nameFor(r.userId);
      return { userId: r.userId, displayName, initials: initialsOf(displayName), score: r.score };
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  return {
    you: yourScore,
    friends,
    friendsAvg: friends.length ? meanScore(friends.map((f) => f.score)) : undefined,
    globalAvg: ratings.length ? meanScore(ratings.map((r) => r.score)) : undefined,
    globalCount: ratings.length,
  };
}

/** Compact count label, e.g. 1290 → "1.3k", 9800 → "9.8k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
