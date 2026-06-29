/**
 * In-memory ratings store. Holds the user's ranked list and the banked
 * comparison log, and exposes the ranking engine to screens.
 *
 * This is intentionally simple (React state, no persistence). When the backend
 * lands (SPEC §7), this is where Supabase reads/writes go — the screen-facing
 * API (`useRatings`) stays the same.
 */

import { createContext, useContext, useMemo, useState } from 'react';

import { RatingTiebreakEngine, sortRanked, type RankingEngine } from '@/ranking/engine';
import type { ComparisonEvent, Item, RankedItem } from '@/ranking/types';
import { CATALOG, INITIAL_RANKED } from './catalog';

export interface RatingsApi {
  engine: RankingEngine;
  /** The user's ranked items, sorted for display (score desc, tiebreak desc). */
  ranked: RankedItem[];
  /** Catalog songs the user hasn't rated yet. */
  unrated: Item[];
  /** Apply a finished placement: replace the list and append to the log. */
  commitPlacement: (list: RankedItem[], events: ComparisonEvent[]) => void;
  /** Every head-to-head ever recorded (banked for a future smarter engine). */
  comparisonLog: ComparisonEvent[];
}

export const RatingsContext = createContext<RatingsApi | null>(null);

export function useRatingsState(): RatingsApi {
  const engine = useMemo(() => new RatingTiebreakEngine(), []);
  const [ranked, setRanked] = useState<RankedItem[]>(INITIAL_RANKED);
  const [comparisonLog, setComparisonLog] = useState<ComparisonEvent[]>([]);

  return useMemo<RatingsApi>(() => {
    const ratedIds = new Set(ranked.map((r) => r.item.id));
    return {
      engine,
      ranked: sortRanked(ranked),
      unrated: CATALOG.filter((item) => !ratedIds.has(item.id)),
      comparisonLog,
      commitPlacement: (list, events) => {
        setRanked(list);
        if (events.length) setComparisonLog((log) => [...log, ...events]);
      },
    };
  }, [engine, ranked, comparisonLog]);
}

export function useRatings(): RatingsApi {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used within RatingsContext.Provider');
  return ctx;
}
