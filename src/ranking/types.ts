/**
 * Core types for the rating + ranking system.
 * See SPEC.md §5–6. The 0–10 score does the coarse sort; side-by-side
 * comparisons only break ties between items sharing the same score.
 */

export type ItemType = 'song' | 'album' | 'artist';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

/** An item the user has rated, as stored. */
export interface RankedItem {
  item: Item;
  /** The user's 0–10 number. Headline score; does the coarse sort. */
  score: number;
  /**
   * Ordering value used ONLY to sort within an identical score.
   * Higher tiebreak = ranked higher. Meaningless across different scores.
   */
  tiebreak: number;
}

/** A single head-to-head shown during placement: the new item vs an existing one. */
export interface Comparison {
  newItem: Item;
  against: Item;
}

/**
 * The banked comparison log (SPEC §5). Every head-to-head is recorded even
 * though the simple engine only needs the resulting order — replaying these
 * later lets us swap in a smarter engine (e.g. Elo) without re-asking users.
 */
export interface ComparisonEvent {
  winnerId: string;
  loserId: string;
  timestamp: number;
}
