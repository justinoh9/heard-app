/**
 * Pure aggregation of raw like rows into per-target summaries. Split out of
 * the Supabase backend so it's unit-testable without a network dependency,
 * mirroring src/comments/filter.ts's split between pure logic and I/O.
 */

import type { LikeRow, LikeSummary } from './types';

/** Every requested targetId gets a summary, even with zero rows (count: 0). */
export function summarize(rows: LikeRow[], targetIds: string[], userId: string): Map<string, LikeSummary> {
  const summaries = new Map<string, LikeSummary>();
  for (const targetId of targetIds) {
    summaries.set(targetId, { targetId, count: 0, likedByMe: false });
  }
  for (const row of rows) {
    const summary = summaries.get(row.targetId);
    if (!summary) continue;
    summary.count += 1;
    if (row.userId === userId) summary.likedByMe = true;
  }
  return summaries;
}
