/**
 * In-memory ratings store. Holds the user's ranked albums and the banked
 * comparison log, and exposes the ranking engine to screens.
 *
 * Albums to rate now come from MusicBrainz search (src/music), so there's no
 * static "unrated" pool. When the backend lands (SPEC §7), this is where
 * Supabase reads/writes go — the screen-facing API (useRatings) stays the same.
 */

import { createContext, useContext, useMemo, useState } from 'react';

import { RatingTiebreakEngine, sortRanked, type RankingEngine } from '@/ranking/engine';
import type { ComparisonEvent, RankedItem } from '@/ranking/types';
import { useStreaks } from '@/streaks/store';
import { INITIAL_RANKED } from './catalog';

export interface RatingsApi {
  engine: RankingEngine;
  /** The user's ranked albums, sorted for display (score desc, tiebreak desc). */
  ranked: RankedItem[];
  /** Look up the user's existing rating for an item, if any. */
  ratingFor: (itemId: string) => RankedItem | undefined;
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
  const streaks = useStreaks();

  return useMemo<RatingsApi>(() => {
    const sorted = sortRanked(ranked);
    return {
      engine,
      ranked: sorted,
      comparisonLog,
      ratingFor: (itemId) => sorted.find((r) => r.item.id === itemId),
      commitPlacement: (list, events) => {
        setRanked(list);
        if (events.length) setComparisonLog((log) => [...log, ...events]);
        streaks.recordActivity();
      },
    };
  }, [engine, ranked, comparisonLog, streaks]);
}

export function useRatings(): RatingsApi {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used within RatingsContext.Provider');
  return ctx;
}
