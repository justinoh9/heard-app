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
import type { ComparisonEvent, Item, RankedItem } from '@/ranking/types';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

import { diaryBackend } from '@/diary/provider';

import { INITIAL_RANKED } from './catalog';
import { ratingsBackend } from './ratings-provider';

/**
 * What a brand-new user starts with. Local/demo mode seeds the mock list so a
 * zero-config checkout never opens empty; against the real cloud backend a new
 * user starts empty — otherwise their first commit would persist the demo
 * albums as real ratings, polluting profiles and compatibility scores.
 */
const NEW_USER_LIST: RankedItem[] = isSupabaseConfigured() ? [] : INITIAL_RANKED;

export interface RatingsApi {
  engine: RankingEngine;
  /** The user's ranked albums, sorted for display (score desc, tiebreak desc). */
  ranked: RankedItem[];
  /** True while the stored ratings are still hydrating after sign-in. */
  loading: boolean;
  /** Look up the user's existing rating for an item, if any. */
  ratingFor: (itemId: string) => RankedItem | undefined;
  /**
   * Apply a finished placement: replace the list and append to the log.
   * Pass `rated` (the item just placed + its score) so the activity feed
   * event fires — the blueprint invariant is that every log path emits one.
   */
  commitPlacement: (
    list: RankedItem[],
    events: ComparisonEvent[],
    rated?: { item: Item; score: number; review?: string },
  ) => void;
  /** Remove one rating from the list (the banked comparison log is kept). */
  removeRating: (itemId: string) => void;
  /** Every head-to-head ever recorded (banked for a future smarter engine). */
  comparisonLog: ComparisonEvent[];
}

export const RatingsContext = createContext<RatingsApi | null>(null);

export function useRatingsState(): RatingsApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const engine = useMemo(() => new RatingTiebreakEngine(), []);
  const backend = ratingsBackend;
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [comparisonLog, setComparisonLog] = useState<ComparisonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const streaks = useStreaks();
  const social = useSocial();

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
        setRanked(stored?.list ?? NEW_USER_LIST);
        setComparisonLog(stored?.events ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('[ratings] load failed, starting empty for this session:', e);
        setRanked(NEW_USER_LIST);
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
      commitPlacement: (list, events, rated) => {
        // Optimistic: the UI settles immediately; the backend syncs behind it.
        setRanked(list);
        if (events.length) setComparisonLog((log) => [...log, ...events]);
        streaks.recordActivity();
        if (rated) {
          social.publish('rated', {
            itemId: rated.item.id,
            itemType: rated.item.type,
            title: rated.item.title,
            artist: rated.item.artist,
            artUrl: rated.item.artUrl,
            score: rated.score,
            // Optional review, so the feed card shows the quote (blueprint §4.3).
            review: rated.review,
          });
          // Every active log is a dated diary entry (blueprint §1.1). Additive
          // to the canonical ranked list; re-logging on a new day is a new row.
          if (userId && rated.item.type !== 'artist') {
            diaryBackend
              .log({
                userId,
                item: {
                  id: rated.item.id,
                  type: rated.item.type,
                  title: rated.item.title,
                  artist: rated.item.artist,
                  artUrl: rated.item.artUrl,
                },
                score: rated.score,
                note: rated.review,
              })
              .catch((e: unknown) => console.warn('[diary] log failed:', e));
          }
        }
        if (userId) {
          backend.commit(userId, list, events).catch((e: unknown) => {
            console.warn('[ratings] sync failed (kept locally for this session):', e);
          });
        }
      },
      removeRating: (itemId) => {
        // Optimistic, like commits. No feed event — removals are housekeeping.
        setRanked((prev) => prev.filter((r) => r.item.id !== itemId));
        if (userId) {
          backend.remove(userId, itemId).catch((e: unknown) => {
            console.warn('[ratings] remove failed (kept locally for this session):', e);
          });
        }
      },
    };
  }, [engine, backend, ranked, loading, comparisonLog, streaks, social, userId]);
}

export function useRatings(): RatingsApi {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatings must be used within RatingsContext.Provider');
  return ctx;
}
