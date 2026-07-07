/**
 * Loads one item's real ratings and folds them into a "you / friends / global"
 * breakdown for the item page. Thin glue: the Supabase fetch lives behind the
 * SocialBackend seam, the aggregation is the pure, tested summarizeItemScores.
 *
 * Friend names resolve against the public people directory (useSocial), and the
 * follow graph decides who counts as a friend. Guests still get global stats
 * (public reads); the friends section just comes back empty for them.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';

import { summarizeItemScores, type ItemScoreSummary } from './item-scores';
import { socialBackend } from './provider';
import { useSocial } from './store';
import type { ItemRating } from './types';

export interface ItemScoresState {
  summary: ItemScoreSummary | null;
  loading: boolean;
  error: string | null;
}

export function useItemScores(itemId: string, yourScore?: number): ItemScoresState {
  const { user } = useAuth();
  const { people, followingIds } = useSocial();
  const [ratings, setRatings] = useState<ItemRating[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRatings(null);
    setError(null);
    socialBackend
      .ratingsForItem(itemId)
      .then((rows) => {
        if (!cancelled) setRatings(rows);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('[social] item ratings load failed:', e);
        setError('Could not load ratings.');
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const nameFor = useMemo(() => {
    const names = new Map(people.map((p) => [p.userId, p.displayName]));
    return (id: string) => names.get(id) ?? 'A friend';
  }, [people]);

  const summary = useMemo(
    () =>
      ratings
        ? summarizeItemScores(ratings, {
            yourScore,
            followingIds,
            viewerId: user?.id ?? null,
            nameFor,
          })
        : null,
    [ratings, yourScore, followingIds, user?.id, nameFor],
  );

  return { summary, loading: ratings === null && error === null, error };
}
