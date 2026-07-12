/**
 * Want-to-listen queue seam (ROADMAP Phase 2 / G1; PRODUCT_BLUEPRINT §2.A). A
 * one-tap bookmark on any song/album feeding a personal listen-later list —
 * the pre-listen intent list, distinct from `ratings` (already ranked) and the
 * dated `diary`. Persistence sits behind `QueueBackend` (provider.ts): Supabase
 * (0012_queue.sql) or on-device. The store (store.tsx) exposes `useQueue()`.
 */

import type { ItemType } from '@/ranking/types';

export interface QueueItem {
  id: string;
  itemId: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
  /** ISO timestamp the item was bookmarked. */
  createdAt: string;
}

/** What a bookmark records (the item to queue for a user). */
export interface QueueInput {
  userId: string;
  itemId: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class QueueError extends Error {}

export interface QueueBackend {
  /** A user's queue, newest first. */
  listFor(userId: string): Promise<QueueItem[]>;
  /** Bookmark an item (idempotent — bookmarking a queued item is a no-op). */
  add(input: QueueInput): Promise<QueueItem>;
  /** Remove a bookmark by item id. */
  remove(userId: string, itemId: string): Promise<void>;
}
