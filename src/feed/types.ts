/**
 * Daily-drop seam. The "what I'm listening to right now" card at the top of the
 * feed (SPEC §2/§3). Screens talk to `useFeed()` (store.tsx); persistence sits
 * behind `DropsBackend` (Supabase 0009_drops.sql, or the on-device world),
 * chosen in provider.ts like the ratings/social/concerts seams.
 */

import type { ItemType } from '@/ranking/types';

export interface DropItem {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

export interface DailyDrop {
  /** The drop's owner (auth uid). Keyed per user — one active drop each. */
  userId: string;
  item: DropItem;
  caption?: string;
  /** ISO timestamp the drop was posted; the 24h countdown runs from here. */
  createdAt: string;
}

export interface PostDropInput {
  item: DropItem;
  caption?: string;
}

/** How long a drop stays live before it expires (24h — the daily mechanic). */
export const DROP_TTL_MS = 24 * 60 * 60 * 1000;

/** Thrown for expected persistence failures — UI-safe message. */
export class DropsError extends Error {}

export interface DropsBackend {
  /** The user's current active drop, or null if none / expired. */
  current(userId: string): Promise<DailyDrop | null>;
  /** Post or replace the user's drop (upsert — one active drop per user). */
  post(userId: string, input: PostDropInput): Promise<DailyDrop>;
  /** Remove the user's drop. */
  clear(userId: string): Promise<void>;
}
