/**
 * In-memory daily-drop store. Holds the current user's "what I'm listening to"
 * drop — the audio-BeReal card at the top of the feed (SPEC §2/§3). Mirrors the
 * ratings seam (src/data/store): screens talk only to `useFeed()`, so when the
 * backend lands this is where Supabase reads/writes go without touching the UI.
 *
 * Scoped to the user's own active drop for now; friends' activity still comes
 * from the mock FEED in src/data/catalog.
 */

import { createContext, useContext, useMemo, useState } from 'react';

import type { ItemType } from '@/ranking/types';
import { useStreaks } from '@/streaks/store';

export interface DropItem {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

export interface DailyDrop {
  id: string;
  item: DropItem;
  caption?: string;
  /** ISO timestamp the drop was posted. */
  createdAt: string;
}

export interface PostDropInput {
  item: DropItem;
  caption?: string;
}

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
  const [myDrop, setMyDrop] = useState<DailyDrop | null>(null);
  const streaks = useStreaks();

  return useMemo<FeedApi>(
    () => ({
      myDrop,
      postDrop: ({ item, caption }) => {
        setMyDrop({
          id: `drop-${Date.now()}`,
          item,
          caption: caption?.trim() ? caption.trim() : undefined,
          createdAt: new Date().toISOString(),
        });
        streaks.recordActivity();
      },
      clearDrop: () => setMyDrop(null),
    }),
    [myDrop, streaks],
  );
}

export function useFeed(): FeedApi {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used within FeedContext.Provider');
  return ctx;
}
