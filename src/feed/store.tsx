/**
 * Daily-drop store. Holds the current user's "what I'm listening to" drop — the
 * audio-BeReal card at the top of the feed (SPEC §2/§3). Persistence lives
 * behind the `DropsBackend` seam (provider.ts): Supabase (0009_drops.sql) when
 * configured, an on-device AsyncStorage fallback otherwise. Writes are
 * optimistic — the card settles instantly and the commit syncs behind it, same
 * posture as ratings/likes.
 *
 * Mounted below social in _layout.tsx because postDrop publishes a feed event;
 * friends' drops still ride the activity feed (src/social), this store is the
 * viewer's own active drop.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

import { dropsBackend } from './provider';
import { isActiveDrop } from './rows';
import type { DailyDrop, DropItem, PostDropInput } from './types';

export type { DailyDrop, DropItem, PostDropInput } from './types';

export interface FeedApi {
  /** The user's current daily drop, or null if they haven't posted one. */
  myDrop: DailyDrop | null;
  /** Post (or replace) the user's daily drop. */
  postDrop: (input: PostDropInput) => void;
  /** Remove the user's drop. */
  clearDrop: () => void;
}

export const FeedContext = createContext<FeedApi | null>(null);

export function useFeedState(): FeedApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [myDrop, setMyDrop] = useState<DailyDrop | null>(null);
  const streaks = useStreaks();
  const social = useSocial();

  // Hydrate the viewer's active drop on sign-in; clear it on sign-out. An
  // expired drop comes back null from the backend, so the card self-heals.
  useEffect(() => {
    if (!userId) {
      setMyDrop(null);
      return;
    }
    let cancelled = false;
    dropsBackend
      .current(userId)
      .then((drop) => {
        if (!cancelled) setMyDrop(drop && isActiveDrop(drop) ? drop : null);
      })
      .catch((e: unknown) => console.warn('[feed] drop load failed:', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<FeedApi>(
    () => ({
      myDrop,
      postDrop: ({ item, caption }) => {
        if (!userId) return;
        const trimmed = caption?.trim() ? caption.trim() : undefined;
        // Optimistic: show the card now, sync behind it.
        const optimistic: DailyDrop = {
          userId,
          item,
          caption: trimmed,
          createdAt: new Date().toISOString(),
        };
        setMyDrop(optimistic);
        streaks.recordActivity();
        // Every log path emits a feed event (blueprint §1.3).
        social.publish('drop', {
          itemId: item.id,
          itemType: item.type,
          title: item.title,
          artist: item.artist,
          artUrl: item.artUrl,
          caption: trimmed,
        });
        dropsBackend
          .post(userId, { item, caption: trimmed })
          .then((stored) => setMyDrop(stored))
          .catch((e: unknown) => console.warn('[feed] drop post failed:', e));
      },
      clearDrop: () => {
        setMyDrop(null);
        if (userId) {
          dropsBackend.clear(userId).catch((e: unknown) => console.warn('[feed] drop clear failed:', e));
        }
      },
    }),
    [myDrop, streaks, social, userId],
  );
}

export function useFeed(): FeedApi {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used within FeedContext.Provider');
  return ctx;
}
