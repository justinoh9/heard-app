/**
 * Social context: the people directory, who the viewer follows, and the
 * activity feed (self + followees). Publishing is fire-and-forget with an
 * optimistic prepend, same posture as ratings commits.
 *
 * Mounted above the ratings and feed bridges in _layout.tsx because both call
 * `publish` — the blueprint invariant is that every log path emits a feed
 * event (§1.3).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';

import { sortEvents } from './feed-rows';
import { socialBackend } from './provider';
import type { Profile, SocialEvent, SocialEventPayload, SocialEventType } from './types';

export interface SocialApi {
  /** Everyone else in the directory (the viewer is filtered out). */
  people: Profile[];
  followingIds: Set<string>;
  /** Recent events by the viewer + followees, newest first. */
  feed: SocialEvent[];
  feedLoading: boolean;
  /** The viewer's chosen Top 4 item ids (empty until picked). */
  myFavorites: string[];
  toggleFollow: (userId: string) => void;
  /** Replace the viewer's Top 4 (optimistic; at most 4 ids). */
  saveFavorites: (itemIds: string[]) => void;
  /** Append an event to the log (stamped with the signed-in user). */
  publish: (type: SocialEventType, payload: SocialEventPayload) => void;
  refresh: () => void;
}

export const SocialContext = createContext<SocialApi | null>(null);

export function useSocialState(): SocialApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.displayName ?? '';
  const [people, setPeople] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<SocialEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myFavorites, setMyFavorites] = useState<string[]>([]);

  const refresh = useCallback(() => {
    if (!userId) return;
    setFeedLoading(true);
    socialBackend
      .following(userId)
      .then(async (ids) => {
        setFollowingIds(new Set(ids));
        const [profiles, events] = await Promise.all([
          socialBackend.listProfiles(),
          socialBackend.feedFor([userId, ...ids]),
        ]);
        setPeople(profiles.filter((p) => p.userId !== userId));
        setMyFavorites(profiles.find((p) => p.userId === userId)?.favorites ?? []);
        setFeed(events);
      })
      .catch((e: unknown) => console.warn('[social] refresh failed:', e))
      .finally(() => setFeedLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPeople([]);
      setFollowingIds(new Set());
      setFeed([]);
      setMyFavorites([]);
      setFeedLoading(false);
      return;
    }
    // Join the directory (idempotent), then load everything.
    socialBackend
      .upsertProfile({ userId, displayName })
      .catch((e: unknown) => console.warn('[social] profile upsert failed:', e))
      .finally(refresh);
  }, [userId, displayName, refresh]);

  return useMemo<SocialApi>(
    () => ({
      people,
      followingIds,
      feed,
      feedLoading,
      myFavorites,
      refresh,
      saveFavorites: (itemIds) => {
        if (!userId) return;
        const capped = itemIds.slice(0, 4);
        const previous = myFavorites;
        setMyFavorites(capped);
        socialBackend.setFavorites(userId, capped).catch((e: unknown) => {
          console.warn('[social] saving favorites failed:', e);
          setMyFavorites(previous);
        });
      },
      toggleFollow: (targetId) => {
        if (!userId || targetId === userId) return;
        const willFollow = !followingIds.has(targetId);
        // Optimistic: flip the set now, reconcile the feed after the write.
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (willFollow) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        socialBackend
          .setFollowing(userId, targetId, willFollow)
          .then(refresh)
          .catch((e: unknown) => {
            console.warn('[social] follow toggle failed:', e);
            setFollowingIds((prev) => {
              const next = new Set(prev);
              if (willFollow) next.delete(targetId);
              else next.add(targetId);
              return next;
            });
          });
      },
      publish: (type, payload) => {
        if (!userId) return;
        socialBackend
          .publishEvent({ userId, displayName, type, payload })
          .then((stored) => setFeed((prev) => sortEvents([stored, ...prev])))
          .catch((e: unknown) => console.warn('[social] publish failed:', e));
      },
    }),
    [people, followingIds, feed, feedLoading, myFavorites, refresh, userId, displayName],
  );
}

export function useSocial(): SocialApi {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialContext.Provider');
  return ctx;
}
