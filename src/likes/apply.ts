/**
 * Pure application of a toggle result to a summary. Split out of the store for
 * the same reason as aggregate.ts — this is the arithmetic that broke, and it
 * should be provable without mounting a component or touching the network.
 */

import type { LikeSummary, LikeToggleResult } from './types';

/**
 * Fold a toggle's result into a summary.
 *
 * Two invariants, both learned the hard way:
 *
 * 1. Apply `delta`, never a delta inferred from `likedByMe`. The old code did
 *    `count + (likedByMe ? 1 : -1)`, which subtracts once per *call* rather
 *    than once per *removed row* — N racing unlikes subtracted N.
 * 2. Floor at zero. A count is a cardinality; it has no negative values to
 *    represent. The client seeds a summary at 0 before the real count loads,
 *    so a toggle resolving mid-load could otherwise render a negative number
 *    even with the delta fixed.
 */
export function applyToggle(summary: LikeSummary, result: LikeToggleResult): LikeSummary {
  return {
    ...summary,
    likedByMe: result.likedByMe,
    count: Math.max(0, summary.count + result.delta),
  };
}
