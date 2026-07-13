/**
 * `useRecommendations` (ROADMAP G3): the "For you" data hook. Loads the followed
 * friends' ranked lists once (per viewer + follow set), then derives the picks
 * client-side — scoring each friend's taste match against the viewer's list
 * (social/compatibility) and folding through the pure `recommend()`. Recompute
 * is cheap and local, so rating something new drops it from the list instantly.
 *
 * Returns [] for guests, users who follow no one, or when nothing clears the bar.
 */

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { compatibility } from '@/social/compatibility';
import { useSocial } from '@/social/store';

import { recommendationsBackend } from './provider';
import { recommend, type FriendList, type Recommendation } from './recommend';
import type { FriendRatingList } from './types';

export function useRecommendations(limit = 12): Recommendation[] {
  const { user } = useAuth();
  const { ranked } = useRatings();
  const { followingIds, people } = useSocial();

  const [lists, setLists] = useState<FriendRatingList[]>([]);

  // Stable dependency for the fetch: the sorted set of followed ids.
  const followKey = useMemo(() => [...followingIds].sort().join(','), [followingIds]);

  useEffect(() => {
    if (!user || followKey === '') {
      setLists([]);
      return;
    }
    let live = true;
    recommendationsBackend
      .friendLists(followKey.split(','))
      .then((res) => {
        if (live) setLists(res);
      })
      .catch((e: unknown) => {
        console.warn('[recommendations] load failed:', e);
        if (live) setLists([]);
      });
    return () => {
      live = false;
    };
  }, [user, followKey]);

  return useMemo(() => {
    if (lists.length === 0) return [];
    const ratedIds = new Set(ranked.map((r) => r.item.id));
    const nameOf = new Map(people.map((p) => [p.userId, p.displayName]));
    const friends: FriendList[] = lists.map((l) => ({
      userId: l.userId,
      userName: nameOf.get(l.userId) ?? 'A friend',
      compatibility: compatibility(ranked, l.ratings).percent,
      ratings: l.ratings,
    }));
    return recommend(friends, ratedIds, { limit });
  }, [lists, ranked, people, limit]);
}
