/**
 * Per-type ranked lists (ROADMAP Phase 2 / PRODUCT_BLUEPRINT §2.B). The engine
 * ranks every rated item together; these pure helpers split that one list into
 * display views by `Item.type` (Albums / Songs) for the profile tabs. Concerts
 * are ranked separately (src/concerts) and keep their own profile section.
 *
 * Framework-free so it runs under the tsx node test runner.
 */

import { sortRanked } from './engine';
import type { RankedItem } from './types';

/** The rateable types that get their own ranked-list tab (artists aren't rated). */
export type RankedListType = 'album' | 'song';
export const RANKED_LIST_TYPES: RankedListType[] = ['album', 'song'];

/** The items of one type, ranked (score desc, tiebreak desc). */
export function rankedOfType(ranked: RankedItem[], type: RankedListType): RankedItem[] {
  return sortRanked(ranked.filter((r) => r.item.type === type));
}

/** Count of rated items per rankable type. */
export function typeCounts(ranked: RankedItem[]): Record<RankedListType, number> {
  const counts: Record<RankedListType, number> = { album: 0, song: 0 };
  for (const r of ranked) {
    if (r.item.type === 'album') counts.album += 1;
    else if (r.item.type === 'song') counts.song += 1;
  }
  return counts;
}

/** Which tab to open first: whichever type has more entries (albums win ties). */
export function defaultListType(ranked: RankedItem[]): RankedListType {
  const c = typeCounts(ranked);
  return c.song > c.album ? 'song' : 'album';
}
