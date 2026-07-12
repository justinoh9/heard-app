/**
 * Pure row ↔ model mapping for daily drops (0009_drops.sql) plus the 24h
 * expiry rule both backends share. Offline-testable, same split as
 * src/data/ratings-rows.ts and src/concerts/rows.ts.
 */

import type { ItemType } from '@/ranking/types';

import { DROP_TTL_MS, type DailyDrop } from './types';

/** public.drops select shape. */
export interface DropRow {
  user_id: string;
  item_id: string;
  item_type: string;
  item_title: string;
  item_artist: string;
  item_art_url: string | null;
  caption: string | null;
  created_at: string;
}

export function fromDropRow(row: DropRow): DailyDrop {
  return {
    userId: row.user_id,
    item: {
      id: row.item_id,
      type: row.item_type as ItemType,
      title: row.item_title,
      artist: row.item_artist,
      artUrl: row.item_art_url ?? undefined,
    },
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
  };
}

export function toDropRow(drop: DailyDrop): DropRow {
  return {
    user_id: drop.userId,
    item_id: drop.item.id,
    item_type: drop.item.type,
    item_title: drop.item.title,
    item_artist: drop.item.artist,
    item_art_url: drop.item.artUrl ?? null,
    caption: drop.caption ?? null,
    created_at: drop.createdAt,
  };
}

/** True while the drop is still within its 24h window. */
export function isActiveDrop(drop: DailyDrop, now: number = Date.now()): boolean {
  return now - Date.parse(drop.createdAt) < DROP_TTL_MS;
}

/** Milliseconds left before the drop expires (never negative). */
export function dropRemainingMs(drop: DailyDrop, now: number = Date.now()): number {
  return Math.max(0, Date.parse(drop.createdAt) + DROP_TTL_MS - now);
}

/** Human countdown for the feed card: "5h left", "42m left", "<1m left". */
export function formatDropRemaining(drop: DailyDrop, now: number = Date.now()): string {
  const ms = dropRemainingMs(drop, now);
  const mins = Math.floor(ms / 60000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h left`;
  if (mins >= 1) return `${mins}m left`;
  return '<1m left';
}
