/**
 * Elo ordering (ROADMAP Phase 3): a second `RankingEngine` view derived by
 * replaying the banked `comparisonLog` — the whole reason every head-to-head
 * has been logged since day one (SPEC §5). Pure and framework-free so it runs
 * under the tsx node test runner, like the tie-break engine's helpers.
 *
 * Elo only reorders *within* a score group: the 0–10 score still does the
 * coarse sort (SPEC §5), so an item can never jump across scores no matter how
 * many head-to-heads it wins. Items with no comparisons stay at the base
 * rating, so they fall back to the existing tie-break order — Elo never
 * invents an order it has no evidence for.
 */

import type { ComparisonEvent, RankedItem } from './types';

/** Standard Elo constants. K is the per-match adjustment ceiling. */
export const ELO_BASE = 1500;
export const ELO_K = 24;
/** Elo's logistic scale — 400 is the chess convention (a 400 gap ≈ 10:1 odds). */
const ELO_SCALE = 400;

/**
 * Replay the comparison events (in timestamp order) into a per-item Elo
 * rating. Deterministic: same events in → same ratings out. Items never seen
 * in a head-to-head are absent from the map (callers treat them as base).
 */
export function computeEloRatings(
  events: ComparisonEvent[],
  opts: { k?: number; base?: number } = {},
): Map<string, number> {
  const k = opts.k ?? ELO_K;
  const base = opts.base ?? ELO_BASE;
  const ratings = new Map<string, number>();
  const get = (id: string) => ratings.get(id) ?? base;

  // Timestamp order so replay is stable regardless of how events were stored.
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  for (const e of ordered) {
    if (e.winnerId === e.loserId) continue; // guard: a self-match is a no-op
    const rw = get(e.winnerId);
    const rl = get(e.loserId);
    // Winner's expected score (logistic on the rating gap). Actual result is
    // 1 for the winner, 0 for the loser; the two deltas are equal & opposite,
    // so Elo is zero-sum per match.
    const expectedWin = 1 / (1 + 10 ** ((rl - rw) / ELO_SCALE));
    ratings.set(e.winnerId, rw + k * (1 - expectedWin));
    ratings.set(e.loserId, rl - k * (1 - expectedWin));
  }
  return ratings;
}

/**
 * Reorder a ranked list by Elo *within each score group*: score desc, then Elo
 * rating desc, then the existing tie-break as the final stable fallback. Never
 * mutates the input. Items sharing a score but lacking comparisons keep their
 * tie-break order (both sit at base).
 */
export function rerankByElo(list: RankedItem[], events: ComparisonEvent[]): RankedItem[] {
  const elo = computeEloRatings(events);
  const rating = (r: RankedItem) => elo.get(r.item.id) ?? ELO_BASE;
  return [...list].sort(
    (a, b) => b.score - a.score || rating(b) - rating(a) || b.tiebreak - a.tiebreak,
  );
}

/**
 * How many items land in a different position under `next` than under `prev`.
 * Drives the "N moved" caption when comparing the Elo order to the score order.
 */
export function countMoved(prev: RankedItem[], next: RankedItem[]): number {
  const prevIndex = new Map(prev.map((r, i) => [r.item.id, i]));
  let moved = 0;
  next.forEach((r, i) => {
    if (prevIndex.get(r.item.id) !== i) moved += 1;
  });
  return moved;
}
