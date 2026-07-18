import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/store';

import { applyToggle } from './apply';
import { SupabaseLikesBackend } from './supabase-backend';
import { LikesError, type LikeSummary, type LikeTargetType } from './types';

const backend = new SupabaseLikesBackend();

function emptySummary(targetId: string): LikeSummary {
  return { targetId, count: 0, likedByMe: false };
}

export interface LikeSummaryState {
  count: number;
  likedByMe: boolean;
  loading: boolean;
  error: string | null;
  toggle: () => Promise<void>;
}

/** Loads and toggles the like on a single target (the item-profile like button). */
export function useLikeSummary(targetType: LikeTargetType, targetId: string): LikeSummaryState {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [summary, setSummary] = useState<LikeSummary>(() => emptySummary(targetId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    // Counts are public — load them for guests too (an empty userId just means
    // likedByMe is always false; see summarize()). Only toggle needs a user.
    setLoading(true);
    setError(null);
    backend
      .listForTargets(targetType, [targetId], userId)
      .then((summaries) => setSummary(summaries.get(targetId) ?? emptySummary(targetId)))
      .catch((e: unknown) => setError(e instanceof LikesError ? e.message : 'Could not load likes.'))
      .finally(() => setLoading(false));
  }, [targetType, targetId, userId]);

  useEffect(load, [load]);

  // Nothing disables the heart while a toggle is in flight, and a tap is cheap
  // to repeat. Dropping re-entrant taps keeps one tap meaning one write.
  const inFlight = useRef(false);

  const toggle = useCallback(async () => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await backend.toggle(targetType, targetId, userId);
      setSummary((s) => applyToggle(s, result));
    } catch (e: unknown) {
      setError(e instanceof LikesError ? e.message : 'Could not update like.');
    } finally {
      inFlight.current = false;
    }
  }, [targetType, targetId, userId]);

  return { count: summary.count, likedByMe: summary.likedByMe, loading, error, toggle };
}

export interface LikeSummariesState {
  summaries: Map<string, LikeSummary>;
  loading: boolean;
  error: string | null;
  toggle: (targetId: string) => Promise<void>;
}

/** Batched load for a list of targets (a page of comments) — one query, not one per row. */
export function useLikeSummaries(targetType: LikeTargetType, targetIds: string[]): LikeSummariesState {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [summaries, setSummaries] = useState<Map<string, LikeSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = targetIds.join(',');

  const load = useCallback(() => {
    if (targetIds.length === 0) {
      setSummaries(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    backend
      .listForTargets(targetType, targetIds, userId)
      .then(setSummaries)
      .catch((e: unknown) => setError(e instanceof LikesError ? e.message : 'Could not load likes.'))
      .finally(() => setLoading(false));
    // `key` is targetIds serialized — re-runs only when the set of targets actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, key, userId]);

  useEffect(load, [load]);

  // Per-target, unlike the single-summary hook: a list of comments has many
  // hearts, and one being mid-flight must not block the others.
  const inFlight = useRef(new Set<string>());

  const toggle = useCallback(
    async (targetId: string) => {
      if (!userId || inFlight.current.has(targetId)) return;
      inFlight.current.add(targetId);
      try {
        const result = await backend.toggle(targetType, targetId, userId);
        setSummaries((prev) => {
          const next = new Map(prev);
          next.set(targetId, applyToggle(next.get(targetId) ?? emptySummary(targetId), result));
          return next;
        });
      } catch (e: unknown) {
        setError(e instanceof LikesError ? e.message : 'Could not update like.');
      } finally {
        inFlight.current.delete(targetId);
      }
    },
    [targetType, userId],
  );

  return { summaries, loading, error, toggle };
}
