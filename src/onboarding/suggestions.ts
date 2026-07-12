/**
 * Pure follow-suggestion ranking for onboarding: given the new user's freshly
 * rated list and a set of candidate users (each with their ranked list), score
 * every candidate with the existing taste-compatibility algorithm and return
 * the best matches to suggest following.
 *
 * Framework-free so it runs under the tsx node test runner, like the other
 * ranking/social helpers. The screen does the I/O (loading candidate lists).
 */

import { compatibility } from '@/social/compatibility';
import type { Item, RankedItem } from '@/ranking/types';

export interface SuggestionCandidate {
  userId: string;
  displayName: string;
  list: RankedItem[];
}

export interface FollowSuggestion {
  userId: string;
  displayName: string;
  /** Taste-match 0–100. */
  percent: number;
  /** Items the two share (drives the "you both love …" hint). */
  sharedFavorites: Item[];
  overlapCount: number;
}

/**
 * Rank candidates by taste match against `mine`, best first. Drops candidates
 * with nothing in common (percent 0 and no overlap and no shared artist), so
 * the wizard never suggests a total stranger just to fill slots. Ties broken by
 * name for stable ordering.
 */
export function rankFollowSuggestions(
  mine: RankedItem[],
  candidates: SuggestionCandidate[],
  max = 5,
): FollowSuggestion[] {
  return candidates
    .map((c) => {
      const compat = compatibility(mine, c.list);
      return {
        userId: c.userId,
        displayName: c.displayName,
        percent: compat.percent,
        sharedFavorites: compat.sharedFavorites,
        overlapCount: compat.overlapCount,
      };
    })
    .filter((s) => s.percent > 0 || s.overlapCount > 0)
    .sort((a, b) => b.percent - a.percent || a.displayName.localeCompare(b.displayName))
    .slice(0, max);
}
