import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/store';

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
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    backend
      .listForTargets(targetType, [targetId], userId)
      .then((summaries) => setSummary(summaries.get(targetId) ?? emptySummary(targetId)))
      .catch((e: unknown) => setError(e instanceof LikesError ? e.message : 'Could not load likes.'))
      .finally(() => setLoading(false));
  }, [targetType, targetId, userId]);

  useEffect(load, [load]);

  const toggle = useCallback(async () => {
    if (!userId) return;
    try {
      const likedByMe = await backend.toggle(targetType, targetId, userId);
      setSummary((s) => ({ ...s, likedByMe, count: s.count + (likedByMe ? 1 : -1) }));
    } catch (e: unknown) {
      setError(e instanceof LikesError ? e.message : 'Could not update like.');
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
    if (!userId || targetIds.length === 0) {
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

  const toggle = useCallback(
    async (targetId: string) => {
      if (!userId) return;
      try {
        const likedByMe = await backend.toggle(targetType, targetId, userId);
        setSummaries((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetId) ?? emptySummary(targetId);
          next.set(targetId, { ...existing, likedByMe, count: existing.count + (likedByMe ? 1 : -1) });
          return next;
        });
      } catch (e: unknown) {
        setError(e instanceof LikesError ? e.message : 'Could not update like.');
      }
    },
    [targetType, userId],
  );

  return { summaries, loading, error, toggle };
}
