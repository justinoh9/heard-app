/**
 * Re-rank nudge (PRODUCT_BLUEPRINT §2.B): "Did you like A more than B?" for a
 * pair of *adjacent* items in the user's ranked list. Two payoffs:
 *
 *   - Same-score pairs whose order was never actually compared (it came from
 *     insertion defaults, "too close", or a skip) can genuinely SWAP — the
 *     answer sharpens the visible order.
 *   - Cross-score pairs can't reorder under the tie-break engine (the score
 *     does the coarse sort), but the answer is banked to the comparison log,
 *     feeding the future Elo engine (SPEC §5).
 *
 * Pure: callers pass the display-sorted list + banked log; the store applies
 * the result via commitPlacement.
 */

import { sortRanked } from './engine';
import type { ComparisonEvent, RankedItem } from './types';

export interface NudgePair {
  /** Currently ranked higher. */
  above: RankedItem;
  /** Currently ranked directly below `above`. */
  below: RankedItem;
  /** Same-score pairs can actually swap; cross-score answers are bank-only. */
  sameScore: boolean;
}

/** Unordered pair key, so a banked A-beat-B also rules out asking B-vs-A. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Pick an adjacent pair the user has never been asked about. Same-score pairs
 * are preferred (their answer can change the order); falls back to
 * cross-score neighbours (bank-only); null when everything adjacent has been
 * compared already.
 */
export function pickNudgePair(
  ranked: RankedItem[],
  log: ComparisonEvent[],
  rand: () => number = Math.random,
): NudgePair | null {
  const sorted = sortRanked(ranked);
  const asked = new Set(log.map((e) => pairKey(e.winnerId, e.loserId)));

  const same: NudgePair[] = [];
  const cross: NudgePair[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const above = sorted[i];
    const below = sorted[i + 1];
    if (asked.has(pairKey(above.item.id, below.item.id))) continue;
    const sameScore = above.score === below.score;
    (sameScore ? same : cross).push({ above, below, sameScore });
  }

  const pool = same.length > 0 ? same : cross;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** ~1 in 3 logs surface a post-log quick match — enough to compound comparison
 *  data passively without turning every rating into a chore (blueprint §2.B). */
export const POST_LOG_NUDGE_RATE = 1 / 3;

/** The coin-flip half of the post-log nudge, split out so it's testable and
 *  the render decision stays stable across re-renders (called once). */
export function shouldNudgeAfterLog(rand: () => number = Math.random): boolean {
  return rand() < POST_LOG_NUDGE_RATE;
}

/**
 * The adjacent, never-compared neighbour of `itemId` to ask about right after
 * logging it, so a fresh rating immediately banks a comparison (blueprint
 * §2.B). Prefers the same-score neighbour (whose answer can actually reorder)
 * over a cross-score one (bank-only). Null when `itemId` isn't ranked or both
 * of its neighbours were already compared.
 */
export function pickNudgeForItem(
  ranked: RankedItem[],
  log: ComparisonEvent[],
  itemId: string,
): NudgePair | null {
  const sorted = sortRanked(ranked);
  const idx = sorted.findIndex((r) => r.item.id === itemId);
  if (idx === -1) return null;
  const asked = new Set(log.map((e) => pairKey(e.winnerId, e.loserId)));

  const neighbours: NudgePair[] = [];
  const consider = (above: RankedItem, below: RankedItem) => {
    if (asked.has(pairKey(above.item.id, below.item.id))) return;
    neighbours.push({ above, below, sameScore: above.score === below.score });
  };
  if (idx - 1 >= 0) consider(sorted[idx - 1], sorted[idx]);
  if (idx + 1 < sorted.length) consider(sorted[idx], sorted[idx + 1]);

  if (neighbours.length === 0) return null;
  return neighbours.find((n) => n.sameScore) ?? neighbours[0];
}

/**
 * Apply an answer: always produces the comparison event to bank; swaps the
 * pair's tiebreaks when the user prefers the lower-ranked item of a
 * same-score pair (the only case the tie-break engine can honour visibly).
 */
export function applyNudge(
  ranked: RankedItem[],
  pair: NudgePair,
  winner: 'above' | 'below',
  now: () => number = () => Date.now(),
): { list: RankedItem[]; event: ComparisonEvent } {
  const won = winner === 'above' ? pair.above : pair.below;
  const lost = winner === 'above' ? pair.below : pair.above;
  const event: ComparisonEvent = {
    winnerId: won.item.id,
    loserId: lost.item.id,
    timestamp: now(),
  };

  let list = ranked;
  if (pair.sameScore && winner === 'below') {
    list = ranked.map((r) => {
      if (r.item.id === pair.above.item.id) return { ...r, tiebreak: pair.below.tiebreak };
      if (r.item.id === pair.below.item.id) return { ...r, tiebreak: pair.above.tiebreak };
      return r;
    });
  }
  return { list, event };
}
