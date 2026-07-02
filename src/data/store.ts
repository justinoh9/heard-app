/**
 * Ratings store: holds the user's ranked list and the banked comparison log,
 * and exposes the ranking engine to screens.
 *
 * Persistence lives behind the `RatingsBackend` seam (PRODUCT_BLUEPRINT §3.3):
 * Supabase when configured (0003_ratings.sql), an AsyncStorage fallback
 * otherwise. Writes are optimistic — the UI updates instantly and the commit
 * syncs in the background (same posture as likes' toggle). Brand-new users are
 * seeded with the demo list so the app never opens empty.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { RatingTiebreakEngine, sortRanked, type RankingEngine } from '@/ranking/engine';
import type { ComparisonEvent, RankedItem } from '@/ranking/types';
import { useStreaks } from '@/streaks/store';

import { INITIAL_RANKED } from './catalog';
import { LocalRatingsBackend, type RatingsBackend } from './ratings-backend';
import { SupabaseRatingsBackend } from './supabase-ratings-backend';

export interface RatingsApi {
  engine: RankingEngine;
  /** The user's ranked albums, sorted for display (score desc, tiebreak desc). */
  ranked: RankedItem[];
  /** True while the stored ratings are still hydrating after sign-in. */
  loading: boolean;
  /** Look up the user's existing rating for an item, if any. */
  ratingFor: (itemId: string) => RankedItem | undefined;
  /** Apply a finished placement: replace the list and append to the log. */
  commitPlacement: (list: RankedItem[], events: ComparisonEvent[]) => void;
  /** Every head-to-head ever recorded (banked for a future smarter engine). */
  comparisonLog: ComparisonEvent[];
}

export const RatingsContext = createContext<RatingsApi | null>(null);

export function useRatingsState(): RatingsApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const engine = useMemo(() => new RatingTiebreakEngine(), []);
  const backend = useMemo<RatingsBackend>(
    () => (isSupabaseConfigured() ? new SupabaseRatingsBackend() : new LocalRatingsBackend()),
    [],
  );
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [comparisonLog, setComparisonLog] = useState<ComparisonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const streaks = useStreaks();

  useEffect(() => {
    if (!userId) {
      setRanked([]);
      setComparisonLog([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    backend
      .load(userId)
      .then((stored) => {
        if (cancelled) return;
        // Null = brand-new user → seed the demo list (persisted with their
        // first real commit, since a commit writes the full list).
        setRanked(stored?.list ?? INITIAL_RANKED);
        setComparisonLog(stored?.events ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Persistence being down shouldn't blank the app — fall back to the
        // seed for this session; commits will retry against the backend.
        console.warn('[ratings] load failed, using seed list:', e);
        setRanked(INITIAL_RANKED);
        setComparisonLog([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, backend]);

  return useMemo<RatingsApi>(() => {
    const sorted = sortRanked(ranked);
    return {
      engine,
      ranked: sorted,
      loading,
      comparisonLog,
      ratingFor: (itemId) => sorted.find((r) => r.item.id === itemId),
      commitPlacement: (list, events) => {
        // Optimistic: the UI settles immediately; the backend syncs behind it.
        setRanked(list);
        if (events.length) setComparisonLog((log) => [...log, ...events]);
        streaks.recordActivity();
        if (userId) {
          backend.commit(userId, list, events).catch((e: unknown) => {
            console.warn('[ratings] sync failed (kept locally for this session):', e);
          });
        }
      },
    };
  }, [engine, backend, ranked, loading, comparisonLog, streaks, userId]);
}

export function useRatings(): RatingsApi {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used within RatingsContext.Provider');
  return ctx;
}
