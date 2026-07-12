/**
 * Pure row ↔ model mapping for the want-to-listen queue (0012_queue.sql).
 * Offline-testable, same split as src/diary/rows.ts.
 */

import type { ItemType } from '@/ranking/types';

import type { QueueInput, QueueItem } from './types';

/** public.queue_items select shape. */
export interface QueueRow {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  item_title: string;
  item_artist: string;
  item_art_url: string | null;
  created_at: string;
}

export function fromQueueRow(row: QueueRow): QueueItem {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.item_type as ItemType,
    title: row.item_title,
    artist: row.item_artist,
    artUrl: row.item_art_url ?? undefined,
    createdAt: row.created_at,
  };
}

export function toQueueRow(input: QueueInput): Omit<QueueRow, 'id' | 'created_at'> {
  return {
    user_id: input.userId,
    item_id: input.itemId,
    item_type: input.type,
    item_title: input.title,
    item_artist: input.artist,
    item_art_url: input.artUrl ?? null,
  };
}

/** Newest bookmark first. */
export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
