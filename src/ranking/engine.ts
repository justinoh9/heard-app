/**
 * Rating + ranking engine. See SPEC.md §5.
 *
 * Design goal: simple now, swappable later. The UI talks only to the
 * `RankingEngine` interface and the `Placement` session it hands back — it
 * never knows whether the simple tie-break engine or a future Elo engine is
 * behind it.
 */

import type { ComparisonEvent, Comparison, Item, RankedItem } from './types';

export interface RankingEngine {
  /**
   * Begin placing `item` (just rated `score`) into the user's list.
   * Returns a session the UI drives until placement is done.
   */
  startPlacement(list: RankedItem[], item: Item, score: number): Placement;

  /** Produce the displayed 0–10 scores. Simple engine: the user's own scores. */
  computeScores(list: RankedItem[]): Map<string, number>;
}

/**
 * A single in-flight placement. The UI loop is:
 *   while ((c = placement.next())) { showComparison(c); placement.choose(...) }
 *   const { list, events } = placement.commit();
 */
export interface Placement {
  /** The next head-to-head to show, or null when the position is settled. */
  next(): Comparison | null;
  /** Record the user's pick for the comparison `next()` just returned. */
  choose(winner: 'new' | 'existing'): void;
  /** Whether placement is finished (no ties, or all comparisons answered). */
  isDone(): boolean;
  /**
   * Finalize: returns the new full list (with the item inserted) and the
   * comparison events to append to the banked log.
   */
  commit(): { list: RankedItem[]; events: ComparisonEvent[] };
}

/** Sort a list for display: score desc, then tiebreak desc. */
export function sortRanked(list: RankedItem[]): RankedItem[] {
  return [...list].sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak);
}

/**
 * The shipping engine. Score does the coarse sort; comparisons binary-insert
 * the new item within the (usually tiny) group of items sharing its score.
 */
export class RatingTiebreakEngine implements RankingEngine {
  /** Stamps comparison events. Injectable so tests stay deterministic. */
  constructor(private now: () => number = () => Date.now()) {}

  startPlacement(list: RankedItem[], item: Item, score: number): Placement {
    return new TiebreakPlacement(list, item, score, this.now);
  }

  computeScores(list: RankedItem[]): Map<string, number> {
    return new Map(list.map((r) => [r.item.id, r.score]));
  }
}

class TiebreakPlacement implements Placement {
  /** Items already at the same score, ranked high → low (by tiebreak desc). */
  private tied: RankedItem[];
  /** Binary-search window over insertion positions [0, tied.length]. */
  private lo = 0;
  private hi: number;
  /** Index in `tied` currently being compared, or -1 when settled. */
  private mid = -1;
  private events: ComparisonEvent[] = [];
  private done = false;
  private finalPos = 0;

  constructor(
    private readonly list: RankedItem[],
    private readonly item: Item,
    private readonly score: number,
    private readonly now: () => number,
  ) {
    this.tied = list
      .filter((r) => r.score === score)
      .sort((a, b) => b.tiebreak - a.tiebreak);
    this.hi = this.tied.length;
    if (this.tied.length === 0) {
      this.finalPos = 0;
      this.done = true;
    }
  }

  next(): Comparison | null {
    if (this.done) return null;
    if (this.lo >= this.hi) {
      this.finalPos = this.lo;
      this.done = true;
      this.mid = -1;
      return null;
    }
    this.mid = Math.floor((this.lo + this.hi) / 2);
    return { newItem: this.item, against: this.tied[this.mid].item };
  }

  choose(winner: 'new' | 'existing'): void {
    if (this.mid < 0) return;
    const opponent = this.tied[this.mid];
    const newWins = winner === 'new';
    this.events.push({
      winnerId: newWins ? this.item.id : opponent.item.id,
      loserId: newWins ? opponent.item.id : this.item.id,
      timestamp: this.now(),
    });
    if (newWins) {
      // New item ranks above this opponent → search the upper half.
      this.hi = this.mid;
    } else {
      this.lo = this.mid + 1;
    }
    this.mid = -1;
  }

  isDone(): boolean {
    return this.done;
  }

  commit(): { list: RankedItem[]; events: ComparisonEvent[] } {
    // Rebuild the tied group's order with the new item spliced in at finalPos,
    // then renumber tiebreaks to clean consecutive integers (top = highest).
    const order = this.tied.map((r) => r.item);
    order.splice(this.finalPos, 0, this.item);
    const n = order.length;
    const renumbered: RankedItem[] = order.map((it, i) => ({
      item: it,
      score: this.score,
      tiebreak: n - 1 - i,
    }));

    const others = this.list.filter((r) => r.score !== this.score);
    return { list: [...others, ...renumbered], events: this.events };
  }
}
