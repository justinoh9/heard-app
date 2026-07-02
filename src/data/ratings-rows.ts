/**
 * Pure row ↔ model mapping for the ratings backend (0003_ratings.sql).
 * Separated from the Supabase client so it can be unit-tested offline —
 * the same split as src/music's parsers vs fetchers.
 */

import type { ComparisonEvent, Item, ItemType, RankedItem } from '@/ranking/types';

/** public.items insert/upsert shape. */
export interface ItemRow {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  art_url: string | null;
}

/** public.ratings upsert shape. */
export interface RatingRow {
  user_id: string;
  item_id: string;
  score: number;
  tiebreak: number;
}

/** public.ratings select shape, with the joined item. */
export interface RatingSelectRow {
  score: number;
  tiebreak: number;
  items: {
    id: string;
    type: string;
    title: string;
    artist: string;
    art_url: string | null;
  };
}

/** public.comparisons insert/select shape. */
export interface ComparisonRow {
  user_id?: string;
  winner_id: string;
  loser_id: string;
  /** ISO timestamp (timestamptz). */
  compared_at: string;
}

export function toItemRow(item: Item): ItemRow {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    artist: item.artist,
    art_url: item.artUrl ?? null,
  };
}

export function toRatingRow(userId: string, ranked: RankedItem): RatingRow {
  return {
    user_id: userId,
    item_id: ranked.item.id,
    score: ranked.score,
    tiebreak: ranked.tiebreak,
  };
}

export function fromRatingRow(row: RatingSelectRow): RankedItem {
  return {
    item: {
      id: row.items.id,
      type: row.items.type as ItemType,
      title: row.items.title,
      artist: row.items.artist,
      artUrl: row.items.art_url ?? undefined,
    },
    score: row.score,
    tiebreak: row.tiebreak,
  };
}

export function toComparisonRow(userId: string, event: ComparisonEvent): ComparisonRow {
  return {
    user_id: userId,
    winner_id: event.winnerId,
    loser_id: event.loserId,
    compared_at: new Date(event.timestamp).toISOString(),
  };
}

export function fromComparisonRow(row: ComparisonRow): ComparisonEvent {
  return {
    winnerId: row.winner_id,
    loserId: row.loser_id,
    timestamp: Date.parse(row.compared_at),
  };
}
